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
  Query,
} from '@nestjs/common';
import { BooksService } from './books.service.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { ListBooksQueryDto } from './dto/list-books-query.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';

// The controller handles HTTP: it maps routes to methods and passes the
// already-validated input to the service. Whatever a method returns is
// sent as JSON.
@Controller('books')
export class BooksController {
  // Nest sees BooksService in the constructor and passes in the instance
  // it created (dependency injection). We never write `new BooksService()`.
  constructor(private readonly booksService: BooksService) {}

  @Get()
  findAll(@Query() query: ListBooksQueryDto) {
    return this.booksService.findAll(query.status);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.booksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.booksService.remove(id);
  }
}
