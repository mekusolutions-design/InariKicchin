import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoStore } from './store.ts';
import {
  enablePhase4,
  addRecipeLine,
  applyRecipeDeduction,
  grossProfit,
  supplierAnalytics,
  enqueueOfflineOrder,
  syncOfflineQueue,
  buildEtimsReceipt,
  requestMpesaConfirmation,
  confirmMpesaStub,
  salesReportCsv,
  type Phase4State,
} from './phase4.ts';
import type { InariStore } from './store.ts';

function store4(): InariStore & Phase4State {
  const s = seedDemoStore() as InariStore & Phase4State;
  enablePhase4(s);
  return s;
}

describe('Phase 4 — Recipes & food cost', () => {
  it('auto-deducts ingredients when enabled', () => {
    const store = store4();
    store.autoDeductRecipes = true;
    const chicken = store.products.find((p) => p.name === 'Chicken Breast')!;
    const menuItem = store.menuItems.find((m) => m.name.includes('Chicken'))!;
    addRecipeLine(store, {
      outputMenuItemId: menuItem.id,
      inputProductId: chicken.id,
      quantityPerUnit: 0.25, // 250g per plate
    });
    const before = chicken.onHandQty;
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { order } = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      tableNo: '1',
      idempotencyKey: 'recipe-1',
      lines: [{ menuItemId: menuItem.id, quantity: 2 }],
      payments: [{ method: 'Cash', amount: menuItem.price * 2 }],
    });
    const result = applyRecipeDeduction(store, order);
    assert.equal(result.deducted.length, 1);
    assert.equal(result.deducted[0].qty, 0.5);
    assert.equal(chicken.onHandQty, before - 0.5);
  });

  it('sale still works when item has no recipe', () => {
    const store = store4();
    store.autoDeductRecipes = true;
    const shake = store.menuItems.find((m) => m.name.includes('Shake'))!;
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { order } = store.createOrder({
      orderType: 'Pick Up',
      cashierId: cashier.id,
      idempotencyKey: 'no-recipe',
      lines: [{ menuItemId: shake.id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: shake.price }],
    });
    const result = applyRecipeDeduction(store, order);
    assert.ok(result.missingRecipes.includes(shake.id));
  });

  it('gross profit uses recipe food cost', () => {
    const store = store4();
    const chicken = store.products.find((p) => p.name === 'Chicken Breast')!;
    const menuItem = store.menuItems.find((m) => m.name.includes('Chicken'))!;
    addRecipeLine(store, {
      outputMenuItemId: menuItem.id,
      inputProductId: chicken.id,
      quantityPerUnit: 0.2,
    });
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { order } = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      idempotencyKey: 'gp-1',
      lines: [{ menuItemId: menuItem.id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: menuItem.price }],
    });
    const gp = grossProfit(store, order);
    assert.ok(gp.foodCost > 0);
    assert.ok(gp.grossProfit < gp.revenueNetVat);
    assert.ok(gp.foodCostPct !== null);
  });
});

describe('Phase 4 — Supplier analytics', () => {
  it('aggregates spend by supplier', () => {
    const store = store4();
    const manager = store.users.find((u) => u.role === 'MANAGER')!;
    store.receiveStock({
      supplierId: store.suppliers[0].id,
      dateReceived: '2026-11-07',
      createdById: manager.id,
      items: [
        {
          productId: store.products[0].id,
          quantity: 2,
          unit: store.products[0].baseUnit,
          totalPrice: 1000,
        },
      ],
    });
    const stats = supplierAnalytics(store, '2026-11-01', '2026-11-30');
    assert.equal(stats.length, 1);
    assert.equal(stats[0].totalSpend, 1000);
    assert.equal(stats[0].purchaseCount, 1);
  });
});

describe('Phase 4 — Offline queue', () => {
  it('queues and syncs orders when back online', () => {
    const store = store4();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const item = store.menuItems[0];
    enqueueOfflineOrder(store, {
      orderType: 'Dine In',
      cashierId: cashier.id,
      tableNo: '9',
      idempotencyKey: 'offline-1',
      lines: [{ menuItemId: item.id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: item.price }],
    });
    assert.equal(store.offlineQueue.length, 1);
    assert.equal(store.orders.length, 0);
    const result = syncOfflineQueue(store);
    assert.equal(result.synced, 1);
    assert.equal(result.failed, 0);
    assert.equal(store.orders.length, 1);
    assert.equal(store.offlineQueue[0].synced, true);
  });
});

describe('Phase 4 — eTIMS readiness & M-Pesa stub', () => {
  it('builds eTIMS-ready receipt without submitting', () => {
    const store = store4();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { order } = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      idempotencyKey: 'etims-1',
      lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
      payments: [{ method: 'M-Pesa', amount: store.menuItems[0].price, reference: 'CODE1' }],
    });
    const receipt = buildEtimsReceipt(store, order);
    assert.equal(receipt.etimsReady, true);
    assert.equal(receipt.etimsSubmitted, false);
    assert.ok(receipt.kraPin);
    assert.equal(receipt.invoiceNumber, order.orderNo);
  });

  it('M-Pesa confirmation stub pending → confirmed', () => {
    const store = store4();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { order } = store.createOrder({
      orderType: 'Pick Up',
      cashierId: cashier.id,
      idempotencyKey: 'mpesa-1',
      lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
      payments: [{ method: 'M-Pesa', amount: store.menuItems[0].price, reference: 'XYZ' }],
    });
    const pending = requestMpesaConfirmation(store, order.id, 'XYZ', store.menuItems[0].price);
    assert.equal(pending.status, 'PENDING');
    const done = confirmMpesaStub(store, pending.id, true);
    assert.equal(done.status, 'CONFIRMED');
  });
});

describe('Phase 4 — CSV export', () => {
  it('exports sales CSV header and rows', () => {
    const store = store4();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      idempotencyKey: 'csv-1',
      lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: store.menuItems[0].price }],
    });
    const today = new Date().toISOString().slice(0, 10);
    const csv = salesReportCsv(store, today, today);
    assert.match(csv, /order_no,date/);
    assert.match(csv, /ORD-/);
  });
});
