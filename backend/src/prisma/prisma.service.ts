import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// PrismaClient is a class, so we can extend it and make it a normal Nest
// provider. Other classes inject PrismaService and call this.prisma.book.*.
// No injection token needed, unlike the pg Pool (PG_POOL) before.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor(config: ConfigService) {
    // The adapter tells Prisma how to reach Postgres: through the pg driver.
    // It creates a pg Pool inside, like we did by hand before.
    const adapter = new PrismaPg(
      { connectionString: config.getOrThrow<string>('DATABASE_URL') },
      {
        // An idle connection can break (e.g. the database restarts). Without this
        // listener, that 'error' event would crash the whole server.
        onPoolError: (err) => console.error('Unexpected database error', err),
      },
    );
    super({ adapter });
  }

  // Lifecycle hook: runs once at startup. Fail now, not on the first request,
  // if the database is unreachable.
  async onModuleInit() {
    await this.$queryRaw`SELECT 1`;
  }

  // Lifecycle hook: close the database connections when the app stops.
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
