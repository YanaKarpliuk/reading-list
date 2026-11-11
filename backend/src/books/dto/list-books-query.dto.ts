import {IsDefined, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf} from 'class-validator';
import { STATUSES, SORT, type BookStatus, type Sort } from '../book.js';
import {Transform, Type} from "class-transformer";
import {trim} from "./create-book.dto.js";

// The query string of GET /books, e.g. ?status=reading&q=weir&sort=title.
// All fields are optional. Query values always arrive as strings, or as an
// array when a key is repeated (?q=a&q=b), which @IsString() rejects.
export class ListBooksQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: BookStatus;

  // Search text. Trimmed, so "  " counts as no search at all.
  @IsOptional()
  @IsString()
  @Transform(trim)
  q?: string;

  @IsOptional()
  @IsIn(SORT)
  sort?: Sort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ValidateIf((query: ListBooksQueryDto) => query.page !== undefined || query.limit !== undefined)
  @IsDefined({ message: 'limit is required when page is set' })
  @Type(() => Number)
  @IsInt()
  @Max(10)
  @Min(1)
  limit?: number;
}
