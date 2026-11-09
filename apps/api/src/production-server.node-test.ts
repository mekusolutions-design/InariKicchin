import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('production API refuses to start while persistence is not wired', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'src/production-server.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        INARI_TOKEN_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      },
      timeout: 10_000,
    },
  );

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr, /Production startup blocked: persistent Prisma-backed repositories are not wired/);
});
