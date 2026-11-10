import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('production API refuses to start without DATABASE_URL', () => {
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
    /Production startup blocked: DATABASE_URL is required/,
  );
});

test('production API can boot when DATABASE_URL is set even without DURABLE_CONFIRMED', () => {
  // We only assert the gate does not fire for missing confirm flag.
  // Full listen is not required; a missing token-length failure after the gate proves gate passed.
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/production-server.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        // Intentionally short secret so process exits after gate without binding a port long-term
        INARI_TOKEN_SECRET: 'short',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/inari',
        INARI_DURABLE_CONFIRMED: '',
      },
      timeout: 15_000,
    },
  );

  const out = result.stderr + result.stdout;
  assert.doesNotMatch(out, /INARI_DURABLE_CONFIRMED=1 are required/);
  assert.match(out, /INARI_TOKEN_SECRET must be set/);
});
