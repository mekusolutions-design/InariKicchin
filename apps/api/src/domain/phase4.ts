/**
 * Phase 4 — Advanced capabilities (Blueprint §16 / §19)
 * - Recipe lines + optional auto ingredient deduction on sale
 * - Food-cost / gross profit when recipes exist
 * - Supplier purchase analytics
 * - Offline order queue (sync when online)
 * - eTIMS-ready receipt payload (integration deferred)
 * - M-Pesa Daraja confirmation stub (structure only)
 */
import { randomUUID } from 'node:crypto';
import type { InariStore, Order, OrderLine, Product } from './store.ts';
import { roundMoney } from './stock/calculations.ts';

export interface RecipeLine {
  id: string;
  /** Output menu item id */
  outputMenuItemId: string;
  /** Input product id (purchased inventory) */
  inputProductId: string;
  quantityPerUnit: number; // base unit of input per 1 menu unit sold
}

export interface OfflineQueuedOrder {
  id: string;
  payload: unknown;
  createdAt: string;
  synced: boolean;
  syncError?: string;
}

export interface EtimsReceiptPayload {
  kraPin: string;
  invoiceNumber: string;
  timestamp: string;
  lines: Array<{ name: string; qty: number; unitPrice: number; lineTotal: number; vatAmount: number }>;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  paymentMethod: string;
  /** Ready for future KRA eTIMS API — not submitted here */
  etimsReady: true;
  etimsSubmitted: false;
}

/** Attach Phase 4 collections onto a store instance. */
export function enablePhase4(store: InariStore & Phase4State): void {
  store.recipeLines = store.recipeLines ?? [];
  store.offlineQueue = store.offlineQueue ?? [];
  store.restaurantKraPin = store.restaurantKraPin ?? 'P0XXXXXXXXX';
  store.autoDeductRecipes = store.autoDeductRecipes ?? false;
  store.mpesaConfirmations = store.mpesaConfirmations ?? [];
}

export interface Phase4State {
  recipeLines: RecipeLine[];
  offlineQueue: OfflineQueuedOrder[];
  restaurantKraPin: string;
  autoDeductRecipes: boolean;
  mpesaConfirmations: Array<{
    id: string;
    orderId: string;
    code: string;
    amount: number;
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    confirmedAt?: string;
  }>;
}

export function addRecipeLine(
  store: InariStore & Phase4State,
  input: { outputMenuItemId: string; inputProductId: string; quantityPerUnit: number },
): RecipeLine {
  const line: RecipeLine = { id: randomUUID(), ...input };
  store.recipeLines.push(line);
  return line;
}

/**
 * Deduct ingredients for sold lines when autoDeductRecipes is on.
 * Sets recipe_deducted conceptually on lines; never fails sale if no recipe.
 */
export function applyRecipeDeduction(
  store: InariStore & Phase4State,
  order: Order,
): { deducted: Array<{ productId: string; qty: number; cost: number }>; missingRecipes: string[] } {
  const deducted: Array<{ productId: string; qty: number; cost: number }> = [];
  const missingRecipes: string[] = [];
  if (!store.autoDeductRecipes) return { deducted, missingRecipes };

  for (const line of order.lines) {
    const recipes = store.recipeLines.filter((r) => r.outputMenuItemId === line.menuItemId);
    if (!recipes.length) {
      missingRecipes.push(line.menuItemId);
      continue;
    }
    for (const r of recipes) {
      const product = store.products.find((p) => p.id === r.inputProductId);
      if (!product) continue;
      const qty = r.quantityPerUnit * line.quantity;
      if (qty > product.onHandQty) {
        throw new Error(
          `Insufficient stock for recipe input ${product.name}: need ${qty}, have ${product.onHandQty}`,
        );
      }
      product.onHandQty -= qty;
      const cost = roundMoney(qty * product.avgUnitCost);
      deducted.push({ productId: product.id, qty, cost });
    }
  }
  return { deducted, missingRecipes };
}

/** Food cost for an order = sum of recipe input costs (0 if no recipes). */
export function orderFoodCost(store: InariStore & Phase4State, order: Order): number {
  let cost = 0;
  for (const line of order.lines) {
    const recipes = store.recipeLines.filter((r) => r.outputMenuItemId === line.menuItemId);
    for (const r of recipes) {
      const product = store.products.find((p) => p.id === r.inputProductId);
      if (!product) continue;
      cost += r.quantityPerUnit * line.quantity * product.avgUnitCost;
    }
  }
  return roundMoney(cost);
}

export function grossProfit(store: InariStore & Phase4State, order: Order): {
  revenueNetVat: number;
  foodCost: number;
  grossProfit: number;
  foodCostPct: number | null;
} {
  const revenueNetVat = roundMoney(order.grandTotal - order.vatTotal);
  const foodCost = orderFoodCost(store, order);
  const gp = roundMoney(revenueNetVat - foodCost);
  const foodCostPct = revenueNetVat > 0 ? roundMoney((foodCost / revenueNetVat) * 100) : null;
  return { revenueNetVat, foodCost, grossProfit: gp, foodCostPct };
}

export function supplierAnalytics(store: InariStore, from: string, to: string) {
  const rows = store.purchases.filter((p) => p.dateReceived >= from && p.dateReceived <= to);
  const bySupplier = new Map<string, { purchaseCount: number; totalSpend: number; items: number }>();
  for (const p of rows) {
    const spend = p.items.reduce((s, i) => s + i.totalPrice, 0);
    const cur = bySupplier.get(p.supplierId) ?? { purchaseCount: 0, totalSpend: 0, items: 0 };
    cur.purchaseCount += 1;
    cur.totalSpend += spend;
    cur.items += p.items.length;
    bySupplier.set(p.supplierId, cur);
  }
  return [...bySupplier.entries()].map(([supplierId, stats]) => {
    const supplier = store.suppliers.find((s) => s.id === supplierId);
    return {
      supplierId,
      supplierName: supplier?.name ?? supplierId,
      ...stats,
      totalSpend: roundMoney(stats.totalSpend),
    };
  });
}

export function enqueueOfflineOrder(store: InariStore & Phase4State, payload: unknown): OfflineQueuedOrder {
  const row: OfflineQueuedOrder = {
    id: randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  store.offlineQueue.push(row);
  return row;
}

export function syncOfflineQueue(store: InariStore & Phase4State): {
  synced: number;
  failed: number;
} {
  let synced = 0;
  let failed = 0;
  for (const row of store.offlineQueue.filter((q) => !q.synced)) {
    try {
      const payload = row.payload as Parameters<InariStore['createOrder']>[0];
      store.createOrder(payload);
      if (store.autoDeductRecipes) {
        const order = store.orders[store.orders.length - 1];
        applyRecipeDeduction(store, order);
      }
      row.synced = true;
      synced += 1;
    } catch (e) {
      row.syncError = e instanceof Error ? e.message : 'sync failed';
      failed += 1;
    }
  }
  return { synced, failed };
}

export function buildEtimsReceipt(
  store: InariStore & Phase4State,
  order: Order,
): EtimsReceiptPayload {
  return {
    kraPin: store.restaurantKraPin,
    invoiceNumber: order.orderNo,
    timestamp: order.createdAt,
    lines: order.lines.map((l) => ({
      name: l.nameSnapshot,
      qty: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      vatAmount: l.vatAmount,
    })),
    subtotal: order.subtotal,
    vatTotal: order.vatTotal,
    grandTotal: order.grandTotal,
    paymentMethod: order.payments.map((p) => p.method).join('+'),
    etimsReady: true,
    etimsSubmitted: false,
  };
}

/** Daraja-style confirmation stub — records intent; real API is Phase 4 owner-scoped. */
export function requestMpesaConfirmation(
  store: InariStore & Phase4State,
  orderId: string,
  code: string,
  amount: number,
): { id: string; status: 'PENDING' } {
  const id = randomUUID();
  store.mpesaConfirmations.push({
    id,
    orderId,
    code,
    amount,
    status: 'PENDING',
  });
  return { id, status: 'PENDING' };
}

export function confirmMpesaStub(
  store: InariStore & Phase4State,
  confirmationId: string,
  ok: boolean,
) {
  const row = store.mpesaConfirmations.find((c) => c.id === confirmationId);
  if (!row) throw new Error('Confirmation not found');
  row.status = ok ? 'CONFIRMED' : 'FAILED';
  row.confirmedAt = new Date().toISOString();
  return row;
}

/** CSV export helper for reports (Excel-compatible plain CSV). */
export function salesReportCsv(store: InariStore, from: string, to: string): string {
  const rows = store.orders.filter(
    (o) =>
      o.createdAt.slice(0, 10) >= from &&
      o.createdAt.slice(0, 10) <= to &&
      o.status !== 'CANCELLED',
  );
  const header = 'order_no,date,type,grand_total,vat_total,payment_status,cashier_id';
  const lines = rows.map(
    (o) =>
      `${o.orderNo},${o.createdAt.slice(0, 10)},${o.orderType},${o.grandTotal},${o.vatTotal},${o.paymentStatus},${o.cashierId}`,
  );
  return [header, ...lines].join('\n');
}
