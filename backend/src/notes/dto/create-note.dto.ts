import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms.js';

// The body of POST /api/books/:bookId/notes. The book comes from the URL,
// not from the body: a client can't attach a note to a different book by
// sending another bookId (whitelist removes it anyway).
export class CreateNoteDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  // A limit keeps one request from storing megabytes of text. The frontend
  // uses the same number for the textarea's maxlength.
  @MaxLength(2000)
  text: string;
}
