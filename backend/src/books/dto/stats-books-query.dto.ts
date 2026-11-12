import {IsOptional, IsString} from 'class-validator';
import {Transform} from "class-transformer";
import {trim} from "./create-book.dto.js";

// The query string of GET /books/stats, e.g. ?q=weir.
export class StatsBooksQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  q?: string;
}
