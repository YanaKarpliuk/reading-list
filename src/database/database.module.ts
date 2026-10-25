import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

// The name ("injection token") other classes use to ask for the pool:
// @Inject(PG_POOL). A pool isn't a class we wrote, so it needs a token.
export const PG_POOL = Symbol('PG_POOL');

// @Global: any module can inject PG_POOL without importing DatabaseModule.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      // Nest calls this once at startup and shares the result everywhere.
      useFactory: async (config: ConfigService) => {
        const pool = new pg.Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
        });

        // An idle connection can break (e.g. the database restarts). Without this
        // listener, that 'error' event would crash the whole server.
        pool.on('error', (err) => {
          console.error('Unexpected database error', err);
        });

        // Fail at startup, not on the first request, if the database is unreachable.
        await pool.query('SELECT 1');
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  // Lifecycle hook: close the database connections when the app stops.
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
