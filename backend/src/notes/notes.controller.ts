import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateNoteDto } from './dto/create-note.dto.js';
import { UpdateNoteDto } from './dto/update-note.dto.js';
import { NotesService } from './notes.service.js';

// The routes follow "shallow nesting":
// - The list and new notes go under the book, because they need a book id:
//   GET/POST /api/books/:bookId/notes.
// - One note has its own id, which is unique on its own. So it doesn't need
//   the book in the URL: PATCH/DELETE /api/notes/:id.
// That's why @Controller() has no prefix and each route has its full path.
@Controller()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('books/:bookId/notes')
  findForBook(@Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.notesService.findForBook(bookId);
  }

  @Post('books/:bookId/notes')
  create(
    @Param('bookId', ParseUUIDPipe) bookId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(bookId, dto);
  }

  @Patch('notes/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto);
  }

  @Delete('notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.notesService.remove(id);
  }
}
