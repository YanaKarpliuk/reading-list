import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BooksService } from './books.service.js';

// A unit test checks one class on its own. BooksService needs PrismaService,
// but here it gets a fake one: no database, no HTTP. Each test says what the
// fake returns, calls the service and checks what the service did with it.
// That makes these tests fast and lets us create cases that are hard to
// produce with a real database, like a P2025 error.

const book = {
  id: '6f1c2c1e-8f43-4f0e-9a51-1d7f0c2b9a10',
  title: 'Dune',
  author: 'Frank Herbert',
  status: 'want',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

// What findMany returns with include: { _count: ... }, and what findAll
// turns it into.
const bookFromPrisma = { ...book, _count: { notes: 2 } };
const bookInList = { ...book, noteCount: 2 };

// Only the Prisma methods BooksService calls. vi.fn() records every call,
// so a test can check the arguments afterwards.
function createPrismaMock() {
  return {
    book: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    // The real $transaction runs the queries and returns their results in
    // the same order. Our findMany and count return promises, so Promise.all
    // does the same.
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
}

describe('BooksService', () => {
  let service: BooksService;
  let prisma: ReturnType<typeof createPrismaMock>;

  // A fresh service and mock for every test, so one test's calls and return
  // values can't leak into the next one.
  beforeEach(async () => {
    prisma = createPrismaMock();

    // The same dependency injection as in the app, but with a replacement:
    // whoever asks for PrismaService gets our mock instead.
    const moduleRef = await Test.createTestingModule({
      providers: [BooksService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BooksService);
  });

  describe('findAll', () => {
    it('turns page and limit into skip and take', async () => {
      prisma.book.findMany.mockResolvedValue([bookFromPrisma]);
      prisma.book.count.mockResolvedValue(11);

      const result = await service.findAll({ page: 3, limit: 5 });

      // Page 3 skips the 10 books of pages 1 and 2.
      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
      expect(result).toEqual({
        items: [bookInList],
        total: 11,
        page: 3,
        limit: 5,
      });
    });

    it('returns every book when there is no limit', async () => {
      prisma.book.findMany.mockResolvedValue([bookFromPrisma]);
      prisma.book.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: undefined, skip: 0 }),
      );
      expect(result).toEqual({
        items: [bookInList],
        total: 1,
        page: 1,
        limit: null,
      });
    });

    it("replaces Prisma's _count with a plain noteCount", async () => {
      prisma.book.findMany.mockResolvedValue([bookFromPrisma]);
      prisma.book.count.mockResolvedValue(1);

      const { items } = await service.findAll({});

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { _count: { select: { notes: true } } },
        }),
      );
      expect(items[0].noteCount).toBe(2);
      expect(items[0]).not.toHaveProperty('_count');
    });

    it('searches title and author, and counts with the same filter', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      await service.findAll({ q: 'weir', status: 'done' });

      const where = {
        status: 'done',
        OR: [
          { title: { contains: 'weir', mode: 'insensitive' } },
          { author: { contains: 'weir', mode: 'insensitive' } },
        ],
      };
      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      // If count used a different where, total wouldn't match the pages.
      expect(prisma.book.count).toHaveBeenCalledWith({ where });
    });

    it('sorts by the chosen column, with id as a tie-breaker', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      await service.findAll({ sort: 'title' });

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ title: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('getStats', () => {
    it('adds up the groups and fills in missing statuses with 0', async () => {
      // groupBy has no row for "reading": no book has that status.
      prisma.book.groupBy.mockResolvedValue([
        { status: 'want', _count: 3 },
        { status: 'done', _count: 2 },
      ]);

      const result = await service.getStats({});

      expect(result).toEqual({ all: 5, want: 3, reading: 0, done: 2 });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the book does not exist', async () => {
      prisma.book.findUnique.mockResolvedValue(null);

      await expect(service.findOne(book.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('turns Prisma error P2025 into NotFoundException', async () => {
      prisma.book.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.update(book.id, { status: 'done' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('passes any other error on unchanged', async () => {
      const error = new Error('Connection lost');
      prisma.book.update.mockRejectedValue(error);

      // Not a 404: a lost connection is a server error (500).
      await expect(service.update(book.id, { status: 'done' })).rejects.toBe(
        error,
      );
    });

    it('does not send null fields, so they keep their value', async () => {
      prisma.book.update.mockResolvedValue(book);

      // null comes from JSON like {"author": null}; the DTO type says
      // string | undefined, hence the cast.
      await service.update(book.id, { author: null as unknown as string });

      expect(prisma.book.update).toHaveBeenCalledWith({
        where: { id: book.id },
        data: { title: undefined, author: undefined, status: undefined },
      });
    });
  });
});
