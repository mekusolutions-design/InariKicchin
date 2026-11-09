/**
 * Concurrent PostgreSQL operations using separate Prisma clients (connections).
 * Skips when DATABASE_URL is unset.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { StockRepository } from './stock-repository.ts';
import { OrderRepository } from './order-repository.ts';

const hasDb = Boolean(process.env.DATABASE_URL);

function client() {
  return new PrismaClient();
}

test('concurrency: parallel stock receipts produce correct final on-hand and WAC', { skip: !hasDb }, async () => {
  const setup = client();
  const unit = await setup.unit.upsert({
    where: { code: 'kg' },
    create: { code: 'kg', name: 'Kilogram', dimension: 'WEIGHT', factor_to_base: 1 },
    update: {},
  });
  const cat = await setup.productCategory.upsert({
    where: { name: 'Meat' },
    create: { name: 'Meat' },
    update: {},
  });
  const supplier = await setup.supplier.create({
    data: { name: `Conc Supplier ${Date.now()}`, is_active: true },
  });
  const product = await setup.product.create({
    data: {
      name: `Conc Product ${Date.now()}`,
      category_id: cat.id,
      base_unit_id: unit.id,
      min_stock_level: 0,
      on_hand_qty: 0,
      avg_unit_cost: 0,
      is_active: true,
    },
  });
  const admin = await setup.user.findFirst({ where: { role: 'ADMINISTRATOR' } });
  assert.ok(admin);
  await setup.$disconnect();

  const day = new Date().toISOString().slice(0, 10);
  const workers = Array.from({ length: 5 }, (_, i) => {
    const c = client();
    const stock = new StockRepository(c);
    return stock
      .receiveStock({
        supplierId: supplier.id,
        dateReceived: day,
        createdById: admin!.id,
        items: [{ productId: product.id, quantity: 2, unit: 'kg', totalPrice: 1000 }],
      })
      .finally(() => c.$disconnect());
  });

  const results = await Promise.allSettled(workers);
  const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
  // Serializable may cause some serialization failures; at least 1 must succeed
  assert.ok(fulfilled >= 1, `expected some receipts to succeed, got ${fulfilled}`);

  const verify = client();
  const updated = await verify.product.findUniqueOrThrow({ where: { id: product.id } });
  const expectedQty = 2 * fulfilled;
  assert.equal(Number(updated.on_hand_qty), expectedQty);
  // All receipts same unit price 500 → WAC 500
  assert.equal(Number(updated.avg_unit_cost), 500);
  await verify.$disconnect();
});

test('concurrency: same POS idempotency key creates only one order', { skip: !hasDb }, async () => {
  const setup = client();
  const admin = await setup.user.findFirst({ where: { role: 'ADMINISTRATOR' } });
  assert.ok(admin);
  await setup.orderType.upsert({
    where: { name: 'Dine In' },
    create: { name: 'Dine In', is_delivery: false, requires_reference: false, sort_order: 0 },
    update: {},
  });
  const cat = await setup.menuCategory.upsert({
    where: { name: 'Mains' },
    create: { name: 'Mains', sort_order: 1 },
    update: {},
  });
  const menuItem = await setup.menuItem.create({
    data: {
      name: `Conc Menu ${Date.now()}`,
      category_id: cat.id,
      price: 500,
      is_available: true,
      is_active: true,
      vat_class: 'standard',
      item_code: `CM${Date.now()}`,
    },
  });
  await setup.$disconnect();

  const key = `conc-idem-${Date.now()}`;
  const workers = Array.from({ length: 4 }, () => {
    const c = client();
    const orders = new OrderRepository(c);
    return orders
      .createOrder({
        cashierId: admin!.id,
        orderType: 'Dine In',
        idempotencyKey: key,
        lines: [{ menuItemId: menuItem.id, quantity: 1 }],
        payments: [{ method: 'Cash', amount: 500 }],
      })
      .finally(() => c.$disconnect());
  });

  const results = await Promise.allSettled(workers);
  const ok = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
  assert.ok(ok.length >= 1);
  const ids = new Set(ok.map((r) => (r.value.order ?? r.value).id));
  assert.equal(ids.size, 1, 'all successful idempotent creates must share one order id');

  const verify = client();
  const count = await verify.restaurantOrder.count({ where: { idempotency_key: key } });
  assert.equal(count, 1);
  await verify.$disconnect();
});
