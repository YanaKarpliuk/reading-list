import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Note } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';

// Notes are a separate module, but they use the same PrismaService (it's
// @Global). The service knows nothing about HTTP, like BooksService.
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  // The notes of one book, oldest first, like a journal.
  async findForBook(bookId: string): Promise<Note[]> {
    // Ask for the book and select only its notes. If we asked
    // note.findMany({ where: { bookId } }) instead, a book that doesn't exist
    // and a book without notes would both give [], and we couldn't answer 404.
    // This is still one request from our code: Prisma loads the relation for us.
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        notes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (book === null) {
      throw new NotFoundException('Book not found');
    }
    return book.notes;
  }

  async create(bookId: string, dto: CreateNoteDto): Promise<Note> {
    try {
      return await this.prisma.note.create({
        data: { bookId, text: dto.text },
      });
    } catch (err) {
      // We don't check first whether the book exists: the foreign key does
      // that. If there's no book with this id, Postgres refuses the insert and
      // Prisma throws P2003 ("foreign key constraint failed"). Checking first
      // would also leave a gap: the book could be deleted between the check
      // and the insert.
      throw toNotFound(err, 'P2003', 'Book not found');
    }
  }

  async update(id: string, dto: UpdateNoteDto): Promise<Note> {
    try {
      return await this.prisma.note.update({
        where: { id },
        data: { text: dto.text },
      });
    } catch (err) {
      throw toNotFound(err, 'P2025', 'Note not found');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.note.delete({ where: { id } });
    } catch (err) {
      throw toNotFound(err, 'P2025', 'Note not found');
    }
  }
}

// Turns one Prisma error code into a 404 with the given message. Any other
// error is passed on unchanged, and Nest answers it with 500.
// P2025: the record to update or delete doesn't exist.
// P2003: a foreign key points at a row that doesn't exist.
function toNotFound(err: unknown, code: string, message: string): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === code
  ) {
    return new NotFoundException(message);
  }
  return err;
}
