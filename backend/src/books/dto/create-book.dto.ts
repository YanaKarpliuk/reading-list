import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { trim } from '../../common/transforms.js';
import { STATUSES, type BookStatus } from '../book.js';

// DTO = Data Transfer Object: describes what a client may send in the body.
// ValidationPipe checks the body against these decorators before the
// controller runs, and removes any field not listed here (like id or createdAt).
export class CreateBookDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: BookStatus;
}
