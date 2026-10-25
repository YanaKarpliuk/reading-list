import { IsIn, IsOptional } from 'class-validator';
import { STATUSES, type BookStatus } from '../book.js';

// The query string of GET /books, e.g. ?status=reading
export class ListBooksQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: BookStatus;
}
