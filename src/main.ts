import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate every @Body(), @Query() and @Param() against its DTO class.
  // whitelist: drop fields the DTO doesn't declare (e.g. id, createdAt).
  // transform: hand the controller the cleaned-up DTO (e.g. the trimmed title).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Run lifecycle hooks like onApplicationShutdown on Ctrl+C.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
