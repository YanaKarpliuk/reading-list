import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// E2E tests for the notes routes, against reading_list_test, like
// books.e2e-spec.ts. Vitest runs the e2e files one after another
// (fileParallelism: false), so the two files never clean up each other's data.

describe('Notes API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // A valid UUID that no book or note has.
  const missingId = '00000000-0000-4000-8000-000000000000';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  // Deleting the books is enough: onDelete: Cascade deletes their notes too.
  beforeEach(async () => {
    await prisma.book.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  // A book with some notes, written straight into the database. createdAt is
  // set by hand, one second apart, so "oldest first" is predictable.
  async function bookWithNotes(texts: string[]) {
    return prisma.book.create({
      data: {
        title: 'Dune',
        // A nested write: creates the book and its notes in one query, and
        // fills in bookId for us.
        notes: {
          create: texts.map((text, i) => ({
            text,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
          })),
        },
      },
      include: { notes: true },
    });
  }

  describe('GET /api/books/:bookId/notes', () => {
    it('returns the notes of the book, oldest first', async () => {
      const book = await bookWithNotes(['First', 'Second']);
      await bookWithNotes(['A note of another book']);

      const res = await request(server())
        .get(`/api/books/${book.id}/notes`)
        .expect(200);

      expect(res.body.map((n: { text: string }) => n.text)).toEqual([
        'First',
        'Second',
      ]);
      expect(res.body[0]).toMatchObject({ bookId: book.id });
    });

    it('returns [] for a book without notes', async () => {
      const book = await bookWithNotes([]);

      const res = await request(server())
        .get(`/api/books/${book.id}/notes`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('answers 404 for a book that does not exist', async () => {
      const res = await request(server())
        .get(`/api/books/${missingId}/notes`)
        .expect(404);

      expect(res.body.message).toBe('Book not found');
    });

    it('answers 400 for a book id that is not a UUID', async () => {
      await request(server()).get('/api/books/123/notes').expect(400);
    });
  });

  describe('POST /api/books/:bookId/notes', () => {
    it('creates a note with trimmed text', async () => {
      const book = await bookWithNotes([]);

      const res = await request(server())
        .post(`/api/books/${book.id}/notes`)
        .send({ text: '  Loved the first chapter  ' })
        .expect(201);

      expect(res.body).toMatchObject({
        text: 'Loved the first chapter',
        bookId: book.id,
      });
      expect(await prisma.note.count({ where: { bookId: book.id } })).toBe(1);
    });

    it('takes the book from the URL, not from the body', async () => {
      const book = await bookWithNotes([]);
      const other = await bookWithNotes([]);

      const res = await request(server())
        .post(`/api/books/${book.id}/notes`)
        .send({ text: 'Hi', bookId: other.id })
        .expect(201);

      expect(res.body.bookId).toBe(book.id);
    });

    it('answers 404 when the book does not exist', async () => {
      // The foreign key rejects the insert; the service turns P2003 into 404.
      const res = await request(server())
        .post(`/api/books/${missingId}/notes`)
        .send({ text: 'Hi' })
        .expect(404);

      expect(res.body.message).toBe('Book not found');
    });

    it.each([
      ['a missing text', {}],
      ['a text of only spaces', { text: '   ' }],
      ['a text that is not a string', { text: 42 }],
      ['a text over 2000 characters', { text: 'a'.repeat(2001) }],
    ])('rejects %s with 400', async (_name, body) => {
      const book = await bookWithNotes([]);

      await request(server())
        .post(`/api/books/${book.id}/notes`)
        .send(body)
        .expect(400);

      expect(await prisma.note.count()).toBe(0);
    });
  });

  describe('PATCH and DELETE /api/notes/:id', () => {
    it('changes the text of a note', async () => {
      const book = await bookWithNotes(['Old text']);

      const res = await request(server())
        .patch(`/api/notes/${book.notes[0].id}`)
        .send({ text: 'New text' })
        .expect(200);

      expect(res.body).toMatchObject({ text: 'New text', bookId: book.id });
    });

    it('rejects a PATCH without text', async () => {
      const book = await bookWithNotes(['Old text']);

      await request(server())
        .patch(`/api/notes/${book.notes[0].id}`)
        .send({})
        .expect(400);
    });

    it('deletes a note', async () => {
      const book = await bookWithNotes(['Keep', 'Delete me']);
      const note = book.notes.find((n) => n.text === 'Delete me')!;

      await request(server()).delete(`/api/notes/${note.id}`).expect(204);

      const left = await prisma.note.findMany({ where: { bookId: book.id } });
      expect(left.map((n) => n.text)).toEqual(['Keep']);
    });

    it('answers 404 for a note that does not exist', async () => {
      await request(server())
        .patch(`/api/notes/${missingId}`)
        .send({ text: 'Hi' })
        .expect(404);
      await request(server()).delete(`/api/notes/${missingId}`).expect(404);
    });
  });

  describe('notes and books together', () => {
    it('shows how many notes each book has in the book list', async () => {
      await bookWithNotes(['One', 'Two']);
      await prisma.book.create({ data: { title: 'Emma' } });

      const res = await request(server())
        .get('/api/books?sort=title')
        .expect(200);

      expect(
        res.body.items.map((b: { title: string; noteCount: number }) => [
          b.title,
          b.noteCount,
        ]),
      ).toEqual([
        ['Dune', 2],
        ['Emma', 0],
      ]);
    });

    it('deletes the notes of a deleted book (cascade)', async () => {
      const book = await bookWithNotes(['One', 'Two']);

      await request(server()).delete(`/api/books/${book.id}`).expect(204);

      expect(await prisma.note.count()).toBe(0);
    });
  });
});
