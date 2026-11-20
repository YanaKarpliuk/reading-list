import { execFileSync } from 'node:child_process';

// Runs once before the e2e tests, with DATABASE_URL already pointing at the
// test database (see vitest.config.e2e.ts). Applies every migration, the same
// command the real server uses, so the test tables always match
// prisma/migrations. It creates the database first if it doesn't exist yet.
export default function setup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
}
