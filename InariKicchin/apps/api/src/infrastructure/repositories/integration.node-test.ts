/**
 * PostgreSQL integration smoke tests against a real local database.
 * Requires DATABASE_URL pointing at an isolated test DB with migrations applied.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { StockRepository } from './stock-repository.ts';
import { OrderRepository } from './order-repository.ts';
import { ReadRepository } from './read-repository.ts';
import { loginPersistent, logoutPersistent, requirePersistentSession } from '../../modules/auth/persistent-auth.ts';

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;

test('integration: persistent login/logout against PostgreSQL', { skip: !hasDb }, async () => {
  const email = process.env.INARI_BOOTSTRAP_ADMIN_EMAIL || 'admin@inarikicchin.test';
  const password = process.env.INARI_BOOTSTRAP_ADMIN_PASSWORD || 'SecureBootstrapPass1!';
  const session = await loginPersistent(email, password);
  assert.ok(session.token);
  assert.equal(session.role, 'ADMINISTRATOR');
  const resolved = await requirePersistentSession(`Bearer ${session.token}`);
  assert.equal(resolved.userId, session.userId);
  await logoutPersistent(session.token);
  await assert.rejects(() => requirePersistentSession(`Bearer ${session.token}`));
});

test('integration: receive stock updates on-hand and WAC atomically', { skip: !hasDb }, async () => {
  const stock = new StockRepository(prisma!);
  // Ensure unit + category + supplier + product
  const unit = await prisma!.unit.upsert({
    where: { code: 'kg' },
    create: { code: 'kg', name: 'Kilogram', dimension: 'WEIGHT', factor_to_base: 1 },
    update: {},
  });
  const cat = await prisma!.productCategory.upsert({
    where: { name: 'Meat' },
    create: { name: 'Meat', sort_order: 1 },
    update: {},
  });
  const supplier = await prisma!.supplier.create({
    data: { name: `Test Supplier ${Date.now()}`, is_active: true },
  });
  const product = await prisma!.product.create({
    data: {
      name: `Chicken Breast ${Date.now()}`,
      category_id: cat.id,
      base_unit_id: unit.id,
      min_stock_level: 5,
      on_hand_qty: 10,
      avg_unit_cost: 500,
      is_active: true,
    },
  });
  const admin = await prisma!.user.findFirst({ where: { role: 'ADMINISTRATOR' } });
  assert.ok(admin);

  const purchase = await stock.receiveStock({
    supplierId: supplier.id,
    dateReceived: new Date().toISOString().slice(0, 10),
    createdById: admin!.id,
    items: [{ productId: product.id, quantity: 5, unit: 'kg', totalPrice: 2500 }],
  });
  assert.ok(purchase.id);
  assert.equal(purchase.items[0].quantityBase, 5);

  const updated = await prisma!.product.findUniqueOrThrow({ where: { id: product.id } });
  assert.equal(Number(updated.on_hand_qty), 15);
  // WAC: (10*500 + 2500) / 15 = 500
  assert.equal(Number(updated.avg_unit_cost), 500);

  const movements = await prisma!.stockMovement.count({
    where: { product_id: product.id, movement_type: 'PURCHASE_RECEIPT' },
  });
  assert.ok(movements >= 1);
});

test('integration: POS order + kitchen transition + void', { skip: !hasDb }, async () => {
  const orders = new OrderRepository(prisma!);
  const admin = await prisma!.user.findFirst({ where: { role: 'ADMINISTRATOR' } });
  assert.ok(admin);

  await prisma!.orderType.upsert({
    where: { name: 'Dine In' },
    create: { name: 'Dine In', is_delivery: false, requires_reference: false, sort_order: 0 },
    update: {},
  });
  const cat = await prisma!.menuCategory.upsert({
    where: { name: 'Mains' },
    create: { name: 'Mains', sort_order: 1 },
    update: {},
  });
  const menuItem = await prisma!.menuItem.create({
    data: {
      name: `Test Burger ${Date.now()}`,
      category_id: cat.id,
      price: 850,
      is_available: true,
      is_active: true,
      vat_class: 'standard',
      item_code: `TB${Date.now()}`,
    },
  });

  const key = `idem-${Date.now()}`;
  const order = await orders.createOrder({
    cashierId: admin!.id,
    orderType: 'Dine In',
    idempotencyKey: key,
    lines: [{ menuItemId: menuItem.id, quantity: 2 }],
    payments: [{ method: 'Cash', amount: 1700 }],
  });
  const created = order.order ?? order;
  assert.ok(created.id);
  assert.equal(created.paymentStatus, 'PAID');
  assert.ok(created.kitchenTicketId || order.ticket);

  // Idempotent retry returns same order
  const again = await orders.createOrder({
    cashierId: admin!.id,
    orderType: 'Dine In',
    idempotencyKey: key,
    lines: [{ menuItemId: menuItem.id, quantity: 2 }],
    payments: [{ method: 'Cash', amount: 1700 }],
  });
  assert.equal((again.order ?? again).id, created.id);

  const ticketId = created.kitchenTicketId || order.ticket?.id;
  const preparing = await orders.updateTicketStatus(ticketId, 'PREPARING', admin!.id);
  assert.equal(preparing.status, 'PREPARING');

  const voided = await orders.voidOrder(created.id, 'Customer cancelled', admin!.id);
  assert.equal(voided.status, 'CANCELLED');
});

test('integration: read repository dashboard and products', { skip: !hasDb }, async () => {
  const read = new ReadRepository(prisma!);
  const products = await read.products();
  assert.ok(Array.isArray(products));
  const dash = await read.dashboard();
  assert.ok(typeof dash.todaySales === 'number');
  const meta = await read.meta();
  assert.ok(meta.orderTypes.length > 0);
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});
