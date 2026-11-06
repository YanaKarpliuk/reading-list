import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { BooksModule } from './books/books.module.js';

// The root module: Nest starts here and follows the imports to find
// every controller and provider in the app.
@Module({
  imports: [
    // Reads .env into process.env. isGlobal: every module can use ConfigService
    // without importing ConfigModule again.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BooksModule,
  ],
})
export class AppModule {}
