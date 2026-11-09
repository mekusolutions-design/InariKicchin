import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('production API refuses to start without durable confirmation', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/production-server.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        INARI_TOKEN_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        DATABASE_URL: '',
        INARI_DURABLE_CONFIRMED: '',
      },
      timeout: 15_000,
    },
  );

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(
    result.stderr + result.stdout,
    /Production startup blocked: DATABASE_URL and INARI_DURABLE_CONFIRMED=1 are required/,
  );
});
