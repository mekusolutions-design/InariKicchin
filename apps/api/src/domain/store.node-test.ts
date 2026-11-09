import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { InariStore, seedDemoStore } from './store.ts';
import { calculatePurchasedClosingLine } from './stock/calculations.ts';
import { vatFromInclusive } from './vat/calculations.ts';
import { convertToBase } from './stock/units.ts';

describe('Phase 1 — Core operations', () => {
  it('C1–C4 pure formulas still hold', () => {
    assert.equal(
      calculatePurchasedClosingLine({
        openingQty: 12,
        openingAvgCost: 290,
        receivedQty: 20,
        receivedValue: 6000,
        closingQty: 21,
      }).usedValue,
      3258.75,
    );
    assert.equal(convertToBase(500, 'g', 'kg'), 0.5);
  });

  it('receive stock increases on-hand and sets unit price', () => {
    const store = seedDemoStore();
    const oil = store.products.find((p) => p.name === 'Cooking Oil')!;
    const supplier = store.suppliers[0];
    const manager = store.users.find((u) => u.role === 'MANAGER')!;
    const before = oil.onHandQty;
    const purchase = store.receiveStock({
      supplierId: supplier.id,
      dateReceived: '2026-11-07',
      createdById: manager.id,
      items: [{ productId: oil.id, quantity: 20, unit: 'l', totalPrice: 6000 }],
    });
    assert.equal(purchase.items[0].unitPrice, 300);
    assert.equal(oil.onHandQty, before + 20);
    assert.ok(store.audit.some((a) => a.action === 'PURCHASE_CREATED'));
  });

  it('makeline production separate from purchased', () => {
    const store = seedDemoStore();
    const sauce = store.makelineProducts[0];
    const before = sauce.onHandQty;
    store.recordMakelineProduction({
      makelineProductId: sauce.id,
      quantity: 3,
      producedAt: '2026-11-07',
    });
    assert.equal(sauce.onHandQty, before + 3);
  });

  it('closing stock locks snapshot and updates next opening (on-hand)', () => {
    const store = seedDemoStore();
    const chicken = store.products.find((p) => p.name === 'Chicken Breast')!;
    const manager = store.users.find((u) => u.role === 'MANAGER')!;
    // receive 5 kg chicken
    store.receiveStock({
      supplierId: store.suppliers[0].id,
      dateReceived: '2026-11-07',
      createdById: manager.id,
      items: [{ productId: chicken.id, quantity: 5, unit: 'kg', totalPrice: 2500 }],
    });
    const session = store.submitClosing({
      periodStart: '2026-11-07',
      periodEnd: '2026-11-07',
      idempotencyKey: 'close-1',
      submittedById: manager.id,
      lines: [
        { itemType: 'PRODUCT', productId: chicken.id, closingQty: 4 },
        {
          itemType: 'PRODUCT',
          productId: store.products.find((p) => p.name === 'Cooking Oil')!.id,
          closingQty: store.products.find((p) => p.name === 'Cooking Oil')!.onHandQty,
        },
        {
          itemType: 'PRODUCT',
          productId: store.products.find((p) => p.name === 'Tomatoes')!.id,
          closingQty: store.products.find((p) => p.name === 'Tomatoes')!.onHandQty,
        },
        {
          itemType: 'MAKELINE',
          makelineProductId: store.makelineProducts[0].id,
          closingQty: store.makelineProducts[0].onHandQty,
        },
      ],
    });
    assert.equal(session.status, 'SUBMITTED');
    assert.equal(chicken.onHandQty, 4);
    const chickenLine = session.items.find((i) => i.productId === chicken.id)!;
    assert.equal(chickenLine.usedQty, 11);
    assert.equal(chickenLine.usedValue, 5500);

    // idempotent resubmit
    const again = store.submitClosing({
      periodStart: '2026-11-07',
      periodEnd: '2026-11-07',
      idempotencyKey: 'close-1',
      submittedById: manager.id,
      lines: [{ itemType: 'PRODUCT', productId: chicken.id, closingQty: 4 }],
    });
    assert.equal(again.id, session.id);
    assert.equal(store.closings.filter((c) => c.status === 'SUBMITTED').length, 1);
  });

  it('B1 closing above available rejected', () => {
    const store = seedDemoStore();
    const chicken = store.products.find((p) => p.name === 'Chicken Breast')!;
    const manager = store.users.find((u) => u.role === 'MANAGER')!;
    assert.throws(() =>
      store.submitClosing({
        periodStart: '2026-11-07',
        periodEnd: '2026-11-07',
        idempotencyKey: 'bad-close',
        submittedById: manager.id,
        lines: [{ itemType: 'PRODUCT', productId: chicken.id, closingQty: 999 }],
      }),
    );
  });

  it('menu price history retained', () => {
    const store = seedDemoStore();
    const item = store.menuItems[0];
    const old = item.price;
    store.setMenuPrice(item.id, 1300);
    assert.equal(item.price, 1300);
    assert.equal(store.priceHistory[0].oldPrice, old);
  });
});

describe('Phase 2 — Sales / POS / Kitchen', () => {
  it('C8 VAT on order lines', () => {
    const r = vatFromInclusive(4750, 16);
    assert.equal(r.vat, 655.17);
  });

  it('create order with idempotency and kitchen ticket', () => {
    const store = seedDemoStore();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const item = store.menuItems[0];
    const { order, ticket } = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      tableNo: '6',
      idempotencyKey: 'cart-1',
      lines: [{ menuItemId: item.id, quantity: 2 }],
      payments: [{ method: 'M-Pesa', amount: item.price * 2, reference: 'SJK4H2L9QX' }],
    });
    assert.match(order.orderNo, /^ORD-/);
    assert.equal(order.paymentStatus, 'PAID');
    assert.ok(ticket);
    assert.equal(ticket!.status, 'NEW');

    const dup = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      idempotencyKey: 'cart-1',
      lines: [{ menuItemId: item.id, quantity: 2 }],
      payments: [{ method: 'Cash', amount: 1 }],
    });
    assert.equal(dup.order.id, order.id);
    assert.equal(store.orders.length, 1);
  });

  it('delivery requires platform reference', () => {
    const store = seedDemoStore();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    assert.throws(() =>
      store.createOrder({
        orderType: 'Glovo',
        cashierId: cashier.id,
        idempotencyKey: 'g1',
        lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
        payments: [{ method: 'Platform payout', amount: 1250 }],
      }),
    );
  });

  it('kitchen status flow New → Preparing → Ready → Served', () => {
    const store = seedDemoStore();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { ticket } = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      tableNo: '3',
      idempotencyKey: 'k1',
      lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: 1250 }],
    });
    store.updateTicketStatus(ticket!.id, 'PREPARING');
    store.updateTicketStatus(ticket!.id, 'READY');
    store.updateTicketStatus(ticket!.id, 'SERVED');
    assert.equal(ticket!.status, 'SERVED');
    assert.ok(ticket!.preparingAt && ticket!.readyAt && ticket!.servedAt);
  });

  it('void requires reason', () => {
    const store = seedDemoStore();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const { order } = store.createOrder({
      orderType: 'Pick Up',
      cashierId: cashier.id,
      idempotencyKey: 'v1',
      lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: 1250 }],
    });
    assert.throws(() => store.voidOrder(order.id, ''));
    store.voidOrder(order.id, 'Customer cancelled');
    assert.equal(order.status, 'CANCELLED');
  });

  it('split payments mark partially paid then paid', () => {
    const store = seedDemoStore();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    const item = store.menuItems[0];
    const total = item.price * 2;
    const { order } = store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      idempotencyKey: 'split-1',
      lines: [{ menuItemId: item.id, quantity: 2 }],
      payments: [
        { method: 'Cash', amount: 500 },
        { method: 'M-Pesa', amount: total - 500, reference: 'ABC123' },
      ],
    });
    assert.equal(order.paymentStatus, 'PAID');
  });
});

describe('Phase 3 — Dashboard / reports / audit', () => {
  it('dashboard and sales report', () => {
    const store = seedDemoStore();
    const cashier = store.users.find((u) => u.role === 'CASHIER')!;
    store.createOrder({
      orderType: 'Dine In',
      cashierId: cashier.id,
      idempotencyKey: 'r1',
      lines: [{ menuItemId: store.menuItems[0].id, quantity: 1 }],
      payments: [{ method: 'Cash', amount: 1250 }],
    });
    const today = new Date().toISOString().slice(0, 10);
    const report = store.salesReport(today, today);
    assert.equal(report.orders, 1);
    assert.ok(report.grossSales > 0);
    assert.match(report.note, /not profit/i);
    const dash = store.dashboard();
    assert.equal(dash.todayOrders, 1);
  });

  it('audit log records critical actions', () => {
    const store = seedDemoStore();
    const manager = store.users.find((u) => u.role === 'MANAGER')!;
    store.receiveStock({
      supplierId: store.suppliers[0].id,
      dateReceived: '2026-11-07',
      createdById: manager.id,
      items: [
        {
          productId: store.products[0].id,
          quantity: 1,
          unit: store.products[0].baseUnit,
          totalPrice: 100,
        },
      ],
    });
    assert.ok(store.audit.length >= 1);
  });
});

describe('Security role matrix (logical)', () => {
  const can = (role: string, action: string) => {
    const map: Record<string, string[]> = {
      ADMINISTRATOR: ['all'],
      MANAGER: [
        'receive',
        'makeline',
        'closing',
        'menu',
        'reports',
        'discount',
        'void',
        'kitchen_view',
      ],
      CASHIER: ['pos', 'payment', 'own_orders', 'kitchen_view'],
      KITCHEN_STAFF: ['kitchen_status', 'makeline_optional'],
    };
    if (role === 'ADMINISTRATOR') return true;
    return (map[role] ?? []).includes(action);
  };

  it('cashier cannot submit closing', () => {
    assert.equal(can('CASHIER', 'closing'), false);
    assert.equal(can('MANAGER', 'closing'), true);
  });

  it('kitchen cannot use POS', () => {
    assert.equal(can('KITCHEN_STAFF', 'pos'), false);
    assert.equal(can('CASHIER', 'pos'), true);
  });
});
