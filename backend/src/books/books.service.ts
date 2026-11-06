import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Book } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BookStatus } from './book.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';

// The service holds the logic and talks to the database.
// It knows nothing about HTTP: no req, no res, no status codes.
@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: BookStatus): Promise<Book[]> {
    // A `where` field that is undefined is ignored, so one query covers
    // both "all books" and "books with this status".
    return this.prisma.book.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<Book> {
    // findUnique returns null when nothing matches; it doesn't throw.
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (book === null) {
      throw new NotFoundException('Book not found');
    }
    return book;
  }

  create(dto: CreateBookDto): Promise<Book> {
    // status left undefined → the database default ('want') is used.
    return this.prisma.book.create({
      data: {
        title: dto.title,
        author: dto.author ?? null,
        status: dto.status ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateBookDto): Promise<Book> {
    try {
      // Prisma skips fields that are undefined, so only the sent fields change.
      // `?? undefined` also turns null into "not sent", like COALESCE did:
      // without it, "author": null would clear the author.
      return await this.prisma.book.update({
        where: { id },
        data: {
          title: dto.title ?? undefined,
          author: dto.author ?? undefined,
          status: dto.status ?? undefined,
        },
      });
    } catch (err) {
      throw toNotFound(err);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.book.delete({ where: { id } });
    } catch (err) {
      throw toNotFound(err);
    }
  }
}

// update and delete throw instead of returning null when the row is missing.
// P2025 is Prisma's code for "record not found". Any other error is passed on
// unchanged, and Nest answers it with 500.
function toNotFound(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2025'
  ) {
    return new NotFoundException('Book not found');
  }
  return err;
}
