import { PartialType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto.js';

// Same fields and rules as CreateBookDto, but every field is optional.
// That's exactly what PATCH needs.
export class UpdateBookDto extends PartialType(CreateBookDto) {}
