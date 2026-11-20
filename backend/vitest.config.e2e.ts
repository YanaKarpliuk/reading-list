import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// The e2e tests start the whole app against a real database and delete every
// book before each test. They must never touch the database in .env, so they
// read their own settings from .env.test.
if (!existsSync('.env.test')) {
  throw new Error(
    'Missing backend/.env.test: copy .env.test.example and fill it in.',
  );
}
const { DATABASE_URL } = parseEnv(readFileSync('.env.test', 'utf8'));

// A second safety net, in case .env.test points at the real database by mistake.
const dbName = DATABASE_URL ? new URL(DATABASE_URL).pathname.slice(1) : '';
if (!dbName.endsWith('_test')) {
  throw new Error(
    `The e2e tests delete all books, so the database name in .env.test must end with _test (got "${dbName}").`,
  );
}

// Set it here, before anything else runs. ConfigModule loads .env but never
// overwrites a variable that already exists, so the app uses this one.
// The global setup and the test files see it too.
process.env.DATABASE_URL = DATABASE_URL;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { DATABASE_URL },
    // Runs once before all test files: creates or updates the tables.
    globalSetup: ['./test/global-setup.ts'],
    // All e2e files share one database. Run them one after another, or one
    // file's cleanup would delete another file's books in the middle of a test.
    fileParallelism: false,
  },
});
