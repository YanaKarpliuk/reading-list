import pg from 'pg';

// A pool keeps a few database connections open and reuses them,
// instead of connecting from scratch on every request.
// Connection details come from DATABASE_URL in the .env file.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// An idle connection can break (e.g. the database restarts). Without this
// listener, that 'error' event would crash the whole server.
pool.on('error', (err) => {
  console.error('Unexpected database error', err);
});
