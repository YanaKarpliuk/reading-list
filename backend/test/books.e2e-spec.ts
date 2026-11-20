import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// An e2e (end-to-end) test runs the whole app: a real HTTP request goes
// through the /api prefix, routing, the ValidationPipe, the controller, the
// service and Prisma to a real Postgres database, and back. Nothing is faked.
// It checks what a client like the Vue app actually gets.
//
// The database is reading_list_test from .env.test, never the real one.

type BookSeed = { title: string; author?: string | null; status?: string };

describe('Books API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Start the app once for the whole file: it's slow, and the tests don't
  // change it. supertest sends requests to it without a real port.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app); // the same prefix and validation as main.ts
    await app.init();

    prisma = app.get(PrismaService);
  });

  // Every test starts with an empty table, so the order of the tests doesn't
  // matter and no test depends on books another test left behind.
  beforeEach(async () => {
    await prisma.book.deleteMany();
  });

  // Close the database connections, or the test run may not end cleanly.
  afterAll(async () => {
    await app.close();
  });

  // Puts books straight into the database, without the API: a test of
  // GET shouldn't fail because POST is broken. createdAt is set by hand, one
  // second apart in the order given, so "oldest first" is predictable.
  async function seed(books: BookSeed[]) {
    await prisma.book.createMany({
      data: books.map((book, i) => ({
        author: null,
        status: 'want',
        ...book,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      })),
    });
  }

  const server = () => app.getHttpServer();
  const titles = (items: { title: string }[]) => items.map((b) => b.title);

  describe('GET /api/books', () => {
    it('returns every book, oldest first, when there is no limit', async () => {
      await seed([{ title: 'A' }, { title: 'B' }, { title: 'C' }]);

      const res = await request(server()).get('/api/books').expect(200);

      expect(titles(res.body.items)).toEqual(['A', 'B', 'C']);
      expect(res.body).toMatchObject({ total: 3, page: 1, limit: null });
    });

    it('returns one page, and the total of all matching books', async () => {
      await seed(
        Array.from({ length: 7 }, (_, i) => ({ title: `Book ${i + 1}` })),
      );

      const res = await request(server())
        .get('/api/books?page=2&limit=5')
        .expect(200);

      expect(titles(res.body.items)).toEqual(['Book 6', 'Book 7']);
      expect(res.body).toMatchObject({ total: 7, page: 2, limit: 5 });
    });

    it('returns an empty page past the end, with the right total', async () => {
      // The frontend relies on this to jump back to the last page.
      await seed(
        Array.from({ length: 7 }, (_, i) => ({ title: `Book ${i + 1}` })),
      );

      const res = await request(server())
        .get('/api/books?page=3&limit=5')
        .expect(200);

      expect(res.body).toMatchObject({ items: [], total: 7 });
    });

    it('rejects a page without a limit, and says why', async () => {
      const res = await request(server()).get('/api/books?page=2').expect(400);

      expect(res.body.message).toContain('limit is required when page is set');
    });

    // it.each runs the same test once per row.
    it.each([
      ['limit above 10', '?limit=11'],
      ['limit 0', '?limit=0'],
      ['page 0', '?page=0&limit=5'],
      ['a page that is not a number', '?page=abc&limit=5'],
      ['a limit that is not a whole number', '?limit=2.5'],
      ['an unknown sort', '?sort=author'],
      ['an unknown status', '?status=lost'],
    ])('rejects %s with 400', async (_name, query) => {
      await request(server()).get(`/api/books${query}`).expect(400);
    });

    it('searches title and author, ignoring case', async () => {
      await seed([
        { title: 'Dune', author: 'Frank Herbert' },
        { title: 'The Martian', author: 'Andy Weir' }, // matches the author
        { title: 'Weird Tales' }, // matches the title; has no author
      ]);

      const res = await request(server()).get('/api/books?q=WEIR').expect(200);

      expect(titles(res.body.items)).toEqual(['The Martian', 'Weird Tales']);
      expect(res.body.total).toBe(2);
    });

    it('treats a search of only spaces as no search', async () => {
      await seed([{ title: 'A' }, { title: 'B' }]);

      const res = await request(server())
        .get('/api/books?q=%20%20')
        .expect(200);

      expect(res.body.total).toBe(2);
    });

    it('filters by status, and total counts only that status', async () => {
      await seed([
        { title: 'A', status: 'done' },
        { title: 'B', status: 'want' },
        { title: 'C', status: 'done' },
      ]);

      const res = await request(server())
        .get('/api/books?status=done')
        .expect(200);

      expect(titles(res.body.items)).toEqual(['A', 'C']);
      expect(res.body.total).toBe(2);
    });

    it('sorts by title', async () => {
      await seed([{ title: 'C' }, { title: 'A' }, { title: 'B' }]);

      const res = await request(server())
        .get('/api/books?sort=title')
        .expect(200);

      expect(titles(res.body.items)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('GET /api/books/stats', () => {
    // A 200 here also proves the route order: if @Get(':id') came first,
    // "stats" would be taken for an id and ParseUUIDPipe would answer 400.
    it('counts every status, with 0 for statuses without books', async () => {
      await seed([
        { title: 'A', status: 'want' },
        { title: 'B', status: 'want' },
        { title: 'C', status: 'done' },
      ]);

      const res = await request(server()).get('/api/books/stats').expect(200);

      expect(res.body).toEqual({ all: 3, want: 2, reading: 0, done: 1 });
    });

    it('counts only the books that match the search', async () => {
      await seed([
        { title: 'Dune', status: 'done' },
        { title: 'Dune Messiah', status: 'want' },
        { title: 'Emma', status: 'want' },
      ]);

      const res = await request(server())
        .get('/api/books/stats?q=dune')
        .expect(200);

      expect(res.body).toEqual({ all: 2, want: 1, reading: 0, done: 1 });
    });
  });

  describe('POST /api/books', () => {
    it('creates a book with a trimmed title and the default status', async () => {
      const res = await request(server())
        .post('/api/books')
        .send({ title: '  Dune  ', author: 'Frank Herbert' })
        .expect(201);

      expect(res.body).toMatchObject({
        title: 'Dune',
        author: 'Frank Herbert',
        status: 'want',
      });
      // It's really in the database, not only in the response.
      expect(await prisma.book.count()).toBe(1);
    });

    it('ignores fields the DTO does not declare, like id', async () => {
      const id = '00000000-0000-4000-8000-000000000000';

      const res = await request(server())
        .post('/api/books')
        .send({ id, title: 'Dune' })
        .expect(201);

      // whitelist: true removed it, so the database chose its own id.
      expect(res.body.id).not.toBe(id);
    });

    it.each([
      ['a missing title', {}],
      ['a title of only spaces', { title: '   ' }],
      ['an unknown status', { title: 'Dune', status: 'lost' }],
    ])('rejects %s with 400', async (_name, body) => {
      await request(server()).post('/api/books').send(body).expect(400);

      expect(await prisma.book.count()).toBe(0);
    });
  });

  describe('GET, PATCH and DELETE /api/books/:id', () => {
    // A valid UUID that no book has.
    const missingId = '00000000-0000-4000-8000-000000000000';

    it('returns one book', async () => {
      const book = await prisma.book.create({ data: { title: 'Dune' } });

      const res = await request(server())
        .get(`/api/books/${book.id}`)
        .expect(200);

      expect(res.body).toMatchObject({ id: book.id, title: 'Dune' });
    });

    it('answers 400 for an id that is not a UUID', async () => {
      await request(server()).get('/api/books/123').expect(400);
    });

    it('answers 404 for a book that does not exist', async () => {
      await request(server()).get(`/api/books/${missingId}`).expect(404);
      await request(server())
        .patch(`/api/books/${missingId}`)
        .send({ status: 'done' })
        .expect(404);
      await request(server()).delete(`/api/books/${missingId}`).expect(404);
    });

    it('changes only the fields that are sent', async () => {
      const book = await prisma.book.create({
        data: { title: 'Dune', author: 'Frank Herbert' },
      });

      const res = await request(server())
        .patch(`/api/books/${book.id}`)
        .send({ status: 'reading' })
        .expect(200);

      expect(res.body).toMatchObject({
        title: 'Dune',
        author: 'Frank Herbert',
        status: 'reading',
      });
    });

    it('deletes a book', async () => {
      const book = await prisma.book.create({ data: { title: 'Dune' } });

      // 204 No Content: success, but no body.
      await request(server()).delete(`/api/books/${book.id}`).expect(204);

      expect(
        await prisma.book.findUnique({ where: { id: book.id } }),
      ).toBeNull();
    });
  });
});
