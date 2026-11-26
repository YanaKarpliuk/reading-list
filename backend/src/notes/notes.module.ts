import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';

// Its own module, next to BooksModule. It doesn't import BooksModule: it
// reads books through Prisma, not through BooksService.
@Module({
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
