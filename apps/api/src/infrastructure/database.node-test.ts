import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'database.ts'), 'utf8');

test('database module requires DATABASE_URL before creating a client', () => {
  assert.match(src, /DATABASE_URL is required/);
  assert.match(src, /getPrismaClient/);
});

test('database module exposes transactional client preferring DIRECT_URL', () => {
  assert.match(src, /getTransactionalPrismaClient/);
  assert.match(src, /DIRECT_URL/);
  assert.match(src, /disconnectDatabase/);
});
