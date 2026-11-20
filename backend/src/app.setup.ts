import { ValidationPipe, type INestApplication } from '@nestjs/common';

// The app-wide settings, shared by main.ts and the e2e tests. If the tests
// set this up on their own, they could pass while the real app is broken
// (e.g. a test app without the /api prefix or without validation).
export function configureApp(app: INestApplication): void {
  // Validate every @Body(), @Query() and @Param() against its DTO class.
  // whitelist: drop fields the DTO doesn't declare (e.g. id, createdAt).
  // transform: hand the controller the cleaned-up DTO (e.g. the trimmed title).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Run lifecycle hooks like onApplicationShutdown on Ctrl+C.
  app.enableShutdownHooks();

  // Every route starts with /api.
  app.setGlobalPrefix('api');
}
