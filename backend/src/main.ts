import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation, the /api prefix and shutdown hooks. In a separate file so
  // the e2e tests can set up their app the same way.
  configureApp(app);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
