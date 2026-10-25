import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import pg from 'pg';
import { PG_POOL } from '../database/database.module.js';
import type { Book, BookStatus } from './book.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';

// The database uses snake_case (created_at), the API uses camelCase (createdAt).
// Double quotes keep the capital C; without them Postgres would lowercase it.
const BOOK_COLUMNS = 'id, title, author, status, created_at AS "createdAt"';

// The service holds the logic and talks to the database.
// It knows nothing about HTTP: no req, no res, no status codes.
@Injectable()
export class BooksService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async findAll(status?: BookStatus): Promise<Book[]> {
    if (status === undefined) {
      const result = await this.pool.query<Book>(
        `SELECT ${BOOK_COLUMNS} FROM books ORDER BY created_at`,
      );
      return result.rows;
    }

    const result = await this.pool.query<Book>(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE status = $1 ORDER BY created_at`,
      [status],
    );
    return result.rows;
  }

  async findOne(id: string): Promise<Book> {
    const result = await this.pool.query<Book>(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('Book not found');
    }
    return result.rows[0];
  }

  async create(dto: CreateBookDto): Promise<Book> {
    const result = await this.pool.query<Book>(
      `INSERT INTO books (title, author, status)
       VALUES ($1, $2, $3)
       RETURNING ${BOOK_COLUMNS}`,
      [dto.title, dto.author ?? null, dto.status ?? 'want'],
    );
    return result.rows[0];
  }

  async update(id: string, dto: UpdateBookDto): Promise<Book> {
    // COALESCE(a, b) returns a, or b if a is NULL. So a field that wasn't sent
    // (passed as NULL) keeps its current value.
    const result = await this.pool.query<Book>(
      `UPDATE books
       SET title  = COALESCE($2, title),
           author = COALESCE($3, author),
           status = COALESCE($4, status)
       WHERE id = $1
       RETURNING ${BOOK_COLUMNS}`,
      [id, dto.title ?? null, dto.author ?? null, dto.status ?? null],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('Book not found');
    }
    return result.rows[0];
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query('DELETE FROM books WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException('Book not found');
    }
  }
}
