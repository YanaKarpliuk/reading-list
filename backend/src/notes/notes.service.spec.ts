import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotesService } from './notes.service.js';

// Unit tests for NotesService with a fake PrismaService, like
// books.service.spec.ts. They cover the error handling, which is the
// part that's easy to get wrong: which Prisma error means which 404.

const bookId = '6f1c2c1e-8f43-4f0e-9a51-1d7f0c2b9a10';
const noteId = '0b6f7a52-3c1e-4c55-9f0e-2a4f8f5d7e21';

function createPrismaMock() {
  return {
    book: { findUnique: vi.fn() },
    note: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
}

// The error Prisma throws for a known problem, with its code.
function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: 'test',
  });
}

describe('NotesService', () => {
  let service: NotesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [NotesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(NotesService);
  });

  describe('findForBook', () => {
    it('returns the notes of the book, oldest first', async () => {
      const notes = [{ id: noteId, text: 'Great start', bookId }];
      prisma.book.findUnique.mockResolvedValue({ notes });

      await expect(service.findForBook(bookId)).resolves.toEqual(notes);
      expect(prisma.book.findUnique).toHaveBeenCalledWith({
        where: { id: bookId },
        select: {
          notes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      });
    });

    it('returns [] for a book without notes', async () => {
      prisma.book.findUnique.mockResolvedValue({ notes: [] });

      await expect(service.findForBook(bookId)).resolves.toEqual([]);
    });

    it('throws NotFoundException when the book does not exist', async () => {
      prisma.book.findUnique.mockResolvedValue(null);

      await expect(service.findForBook(bookId)).rejects.toThrow(
        new NotFoundException('Book not found'),
      );
    });
  });

  describe('create', () => {
    it('saves the note for the book from the URL', async () => {
      prisma.note.create.mockResolvedValue({ id: noteId });

      await service.create(bookId, { text: 'Great start' });

      expect(prisma.note.create).toHaveBeenCalledWith({
        data: { bookId, text: 'Great start' },
      });
    });

    it('turns P2003 (no such book) into "Book not found"', async () => {
      prisma.note.create.mockRejectedValue(prismaError('P2003'));

      await expect(service.create(bookId, { text: 'Hi' })).rejects.toThrow(
        new NotFoundException('Book not found'),
      );
    });
  });

  describe('update and remove', () => {
    it('turn P2025 (no such note) into "Note not found"', async () => {
      prisma.note.update.mockRejectedValue(prismaError('P2025'));
      prisma.note.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.update(noteId, { text: 'Hi' })).rejects.toThrow(
        new NotFoundException('Note not found'),
      );
      await expect(service.remove(noteId)).rejects.toThrow(
        new NotFoundException('Note not found'),
      );
    });

    it('pass any other error on unchanged', async () => {
      const error = prismaError('P1001'); // can't reach the database
      prisma.note.delete.mockRejectedValue(error);

      await expect(service.remove(noteId)).rejects.toBe(error);
    });
  });
});
