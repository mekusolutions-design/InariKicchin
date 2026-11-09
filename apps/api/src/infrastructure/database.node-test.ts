import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./database.ts', import.meta.url), 'utf8');

test('Prisma runtime requires DATABASE_URL before creating a client', () => {
  assert.match(source, /if \(!process\.env\.DATABASE_URL\)/);
  assert.match(source, /DATABASE_URL is required/);
});

test('database readiness uses a read-only SELECT 1 probe', () => {
  assert.match(source, /\$queryRaw`SELECT 1`/);
});

test('Prisma pool exposes graceful disconnect', () => {
  assert.match(source, /export async function disconnectDatabase/);
  assert.match(source, /\$disconnect\(\)/);
});
