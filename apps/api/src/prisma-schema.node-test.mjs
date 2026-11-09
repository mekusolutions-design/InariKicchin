import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, '../prisma/schema.prisma'), 'utf8');
const apiPackage = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));

function model(name) {
  const match = schema.match(new RegExp(`model\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Expected Prisma model ${name}`);
  return match[1];
}

test('Prisma runtime and CLI dependencies are declared', () => {
  assert.ok(apiPackage.dependencies['@prisma/client']);
  assert.ok(apiPackage.devDependencies.prisma);
  assert.ok(apiPackage.scripts['db:generate']);
  assert.ok(apiPackage.scripts['db:migrate:deploy']);
});

test('durable transaction and identity models are present', () => {
  for (const name of ['RestaurantOrder', 'RestaurantOrderLine', 'PaymentRecord', 'KitchenTicket', 'KitchenTicketTransition', 'AuthSession', 'IdempotencyRecord', 'StockMovement']) model(name);
});

test('money and quantity fields retain explicit decimal precision', () => {
  assert.match(model('RestaurantOrder'), /grand_total\s+Decimal\s+@db\.Decimal\(14, 2\)/);
  assert.match(model('RestaurantOrderLine'), /quantity\s+Decimal\s+@db\.Decimal\(14, 4\)/);
  assert.match(model('PaymentRecord'), /amount\s+Decimal\s+@db\.Decimal\(14, 2\)/);
  assert.match(model('StockMovement'), /quantity_delta\s+Decimal\s+@db\.Decimal\(14, 4\)/);
});

test('orders and stock movements carry retry-safe unique keys', () => {
  assert.match(model('RestaurantOrder'), /idempotency_key\s+String\s+@unique/);
  assert.match(model('StockMovement'), /idempotency_key\s+String\s+@unique/);
  assert.match(model('IdempotencyRecord'), /@@unique\(\[scope, key\]\)/);
});

test('auth sessions persist token hashes rather than raw bearer tokens', () => {
  const session = model('AuthSession');
  assert.match(session, /token_hash\s+String\s+@unique/);
  assert.doesNotMatch(session, /token\s+String\s+@unique/);
});

test('persistent authentication includes shared database lockout state', () => {
  assert.match(schema, /model AuthLoginAttempt\s*\{/);
  assert.match(schema, /failed_count\s+Int\s+@default\(0\)/);
  assert.match(schema, /locked_until\s+DateTime\?/);
});
