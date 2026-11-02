// Settings for the Prisma CLI (prisma generate, prisma migrate, ...).
// The running app doesn't read this file; it gets DATABASE_URL from ConfigService.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
