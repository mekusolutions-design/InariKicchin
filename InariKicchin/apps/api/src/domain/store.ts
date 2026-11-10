/**
 * In-memory domain store for Inari Kicchin blueprint workflows.
 * Used for deterministic testing of Phases 1–3 business rules without external DB.
 * Production wiring uses the same service methods over Prisma.
 */
import { randomUUID } from 'node:crypto';
import {
  calculatePurchasedClosingLine,
  calculateMakelineClosingLine,
  assertClosingNotAboveAvailable,
  unitPriceFromReceipt,
  type ClosingLineResult,
} from './stock/calculations.ts';
import { lineVat, type VatMode } from './vat/calculations.ts';
import { convertToBase } from './stock/units.ts';

export type Role = 'ADMINISTRATOR' | 'MANAGER' | 'CASHIER' | 'KITCHEN_STAFF';

export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface Product {
  id: string;
  name: string;
  baseUnit: string;
  minStock: number;
  onHandQty: number;
  avgUnitCost: number;
  isActive: boolean;
}

export interface MakelineProduct {
  id: string;
  name: string;
  unit: string;
  onHandQty: number;
  isActive: boolean;
}

export interface PurchaseItem {
  productId: string;
  quantityBase: number;
  totalPrice: number;
  unitPrice: number;
  expiryDate?: string;
}

export interface Purchase {
  id: string;
  purchaseNo: string;
  supplierId: string;
  dateReceived: string;
  items: PurchaseItem[];
  createdById: string;
}

export interface ClosingSession {
  id: string;
  closingNo: string;
  status: 'DRAFT' | 'SUBMITTED' | 'SUPERSEDED';
  periodStart: string;
  periodEnd: string;
  items: Array<{
    itemType: 'PRODUCT' | 'MAKELINE';
    productId?: string;
    makelineProductId?: string;
    name: string;
    unit: string;
    openingQty: number;
    receivedQty: number;
    wastageQty: number;
    availableQty: number;
    closingQty: number;
    usedQty: number;
    avgUnitCost?: number;
    usedValue?: number;
    wastageValue?: number;
    closingValue?: number;
  }>;
  totalValueUsed: number;
  totalValueWasted: number;
  version: number;
  supersedesId?: string;
  correctionReason?: string;
  idempotencyKey: string;
  submittedById?: string;
  submittedAt?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  isAvailable: boolean;
  isActive: boolean;
  vatClass: 'STANDARD' | 'EXEMPT' | 'ZERO_RATED';
}

export interface OrderLine {
  menuItemId: string;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  vatAmount: number;
  notes?: string;
}

export interface Payment {
  method: string;
  amount: number;
  reference?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  orderType: string;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'COLLECTED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  lines: OrderLine[];
  payments: Payment[];
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  vatMode: VatMode;
  vatRate: number;
  cashierId: string;
  tableNo?: string;
  deliveryRef?: string;
  idempotencyKey: string;
  createdAt: string;
  voidReason?: string;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  ticketNo: string;
  status: Order['status'];
  printCount: number;
  createdAt: string;
  preparingAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface AuditEntry {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  createdAt: string;
}

export class InariStore {
  users: User[] = [];
  products: Product[] = [];
  makelineProducts: MakelineProduct[] = [];
  suppliers: { id: string; name: string; isActive: boolean }[] = [];
  purchases: Purchase[] = [];
  wastage: {
    id: string;
    productId?: string;
    makelineProductId?: string;
    quantityBase: number;
    reasonCode: string;
    wastedOn: string;
  }[] = [];
  makelineProduction: {
    id: string;
    makelineProductId: string;
    quantity: number;
    producedAt: string;
  }[] = [];
  closings: ClosingSession[] = [];
  menuCategories: { id: string; name: string; sortOrder: number }[] = [];
  menuItems: MenuItem[] = [];
  priceHistory: {
    menuItemId: string;
    oldPrice: number;
    newPrice: number;
    changedAt: string;
  }[] = [];
  orders: Order[] = [];
  tickets: KitchenTicket[] = [];
  audit: AuditEntry[] = [];
  vat = { enabled: true, ratePercent: 16, pricesIncludeVat: true as boolean };
  orderTypes = [
    { name: 'Dine In', isDelivery: false, requiresReference: false },
    { name: 'Pick Up', isDelivery: false, requiresReference: false },
    { name: 'Glovo', isDelivery: true, requiresReference: true },
    { name: 'Bolt Food', isDelivery: true, requiresReference: true },
    { name: 'Uber Eats', isDelivery: true, requiresReference: true },
    { name: 'SpeedyDrop', isDelivery: true, requiresReference: true },
    { name: 'NAI Deliver', isDelivery: true, requiresReference: true },
    { name: 'Yum Deliveries', isDelivery: true, requiresReference: true },
  ];
  paymentMethods = ['Cash', 'M-Pesa', 'Card', 'Bank transfer', 'Platform payout'];
  private orderSeq = 0;
  private purchaseSeq = 0;
  private closingSeq = 0;
  private ticketSeq = 0;

  log(action: string, entityType: string, entityId?: string, userId?: string, reason?: string) {
    this.audit.push({
      id: randomUUID(),
      userId,
      action,
      entityType,
      entityId,
      reason,
      createdAt: new Date().toISOString(),
    });
  }

  // ─── Inventory received ───────────────────────────────────────
  receiveStock(input: {
    supplierId: string;
    dateReceived: string;
    createdById: string;
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
      totalPrice: number;
      expiryDate?: string;
    }>;
  }): Purchase {
    const items: PurchaseItem[] = input.items.map((i) => {
      const product = this.products.find((p) => p.id === i.productId);
      if (!product) throw new Error(`Product not found: ${i.productId}`);
      const quantityBase = convertToBase(i.quantity, i.unit, product.baseUnit);
      const unitPrice = unitPriceFromReceipt(i.totalPrice, quantityBase);
      product.onHandQty += quantityBase;
      // Running WAC on receive (pool)
      const poolQty = product.onHandQty;
      const prevValue = (product.onHandQty - quantityBase) * product.avgUnitCost;
      const poolValue = prevValue + i.totalPrice;
      product.avgUnitCost = poolQty > 0 ? poolValue / poolQty : 0;
      return {
        productId: i.productId,
        quantityBase,
        totalPrice: i.totalPrice,
        unitPrice,
        expiryDate: i.expiryDate,
      };
    });
    this.purchaseSeq += 1;
    const purchase: Purchase = {
      id: randomUUID(),
      purchaseNo: `PUR-${input.dateReceived.replace(/-/g, '')}-${String(this.purchaseSeq).padStart(4, '0')}`,
      supplierId: input.supplierId,
      dateReceived: input.dateReceived,
      items,
      createdById: input.createdById,
    };
    this.purchases.push(purchase);
    this.log('PURCHASE_CREATED', 'purchase', purchase.id, input.createdById);
    return purchase;
  }

  recordWastage(input: {
    productId?: string;
    makelineProductId?: string;
    quantityBase: number;
    reasonCode: string;
    wastedOn: string;
    userId?: string;
  }) {
    if (input.productId) {
      const p = this.products.find((x) => x.id === input.productId);
      if (!p) throw new Error('Product not found');
      if (input.quantityBase > p.onHandQty) throw new Error('Wastage exceeds on-hand quantity');
      p.onHandQty -= input.quantityBase;
    }
    if (input.makelineProductId) {
      const m = this.makelineProducts.find((x) => x.id === input.makelineProductId);
      if (!m) throw new Error('Makeline product not found');
      if (input.quantityBase > m.onHandQty) throw new Error('Wastage exceeds on-hand quantity');
      m.onHandQty -= input.quantityBase;
    }
    const row = { id: randomUUID(), ...input };
    this.wastage.push(row);
    this.log('WASTAGE_RECORDED', 'wastage', row.id, input.userId, input.reasonCode);
    return row;
  }

  recordMakelineProduction(input: {
    makelineProductId: string;
    quantity: number;
    producedAt: string;
    userId?: string;
  }) {
    const m = this.makelineProducts.find((x) => x.id === input.makelineProductId);
    if (!m) throw new Error('Makeline product not found');
    m.onHandQty += input.quantity;
    const row = { id: randomUUID(), ...input };
    this.makelineProduction.push(row);
    this.log('MAKELINE_PRODUCTION', 'makeline_production', row.id, input.userId);
    return row;
  }

  // ─── Closing stock ────────────────────────────────────────────
  submitClosing(input: {
    periodStart: string;
    periodEnd: string;
    idempotencyKey: string;
    submittedById: string;
    lines: Array<{
      itemType: 'PRODUCT' | 'MAKELINE';
      productId?: string;
      makelineProductId?: string;
      closingQty: number;
    }>;
    correctionOfId?: string;
    correctionReason?: string;
  }): ClosingSession {
    const existing = this.closings.find(
      (c) => c.idempotencyKey === input.idempotencyKey && c.status === 'SUBMITTED',
    );
    if (existing) return existing;

    // Opening = last submitted closing counts (or current on-hand for first close simplified)
    const last = [...this.closings]
      .filter((c) => c.status === 'SUBMITTED')
      .sort((a, b) => (a.submittedAt! < b.submittedAt! ? 1 : -1))[0];

    const items: ClosingSession['items'] = [];
    let totalValueUsed = 0;
    let totalValueWasted = 0;

    for (const line of input.lines) {
      if (line.itemType === 'PRODUCT') {
        const product = this.products.find((p) => p.id === line.productId);
        if (!product) throw new Error('Product missing');
        const lastItem = last?.items.find(
          (i) => i.itemType === 'PRODUCT' && i.productId === product.id,
        );
        const openingQty = lastItem?.closingQty ?? product.onHandQty;
        // For demo store: received since last close approximated by purchases after periodStart
        const receivedQty = this.purchases
          .filter((p) => p.dateReceived >= input.periodStart)
          .flatMap((p) => p.items)
          .filter((i) => i.productId === product.id)
          .reduce((s, i) => s + i.quantityBase, 0);
        const receivedValue = this.purchases
          .filter((p) => p.dateReceived >= input.periodStart)
          .flatMap((p) => p.items)
          .filter((i) => i.productId === product.id)
          .reduce((s, i) => s + i.totalPrice, 0);
        const wastageQty = this.wastage
          .filter((w) => w.productId === product.id && w.wastedOn >= input.periodStart)
          .reduce((s, w) => s + w.quantityBase, 0);

        const calc = calculatePurchasedClosingLine({
          openingQty: lastItem ? lastItem.closingQty : openingQty - receivedQty + wastageQty,
          openingAvgCost: lastItem?.avgUnitCost ?? product.avgUnitCost,
          receivedQty,
          receivedValue,
          wastageQty,
          closingQty: line.closingQty,
        });
        // Fix opening for first-close simplicity when no last
        const opening =
          lastItem?.closingQty ??
          calc.availableQty - receivedQty + wastageQty + (line.closingQty - (calc.availableQty - receivedQty + wastageQty));
        // Recompute with consistent opening from on-hand path:
        const openQty = lastItem?.closingQty ?? product.onHandQty - receivedQty + wastageQty;
        const calc2 = calculatePurchasedClosingLine({
          openingQty: openQty,
          openingAvgCost: lastItem?.avgUnitCost ?? product.avgUnitCost,
          receivedQty,
          receivedValue,
          wastageQty,
          closingQty: line.closingQty,
        });
        assertClosingNotAboveAvailable(product.name, line.closingQty, calc2.availableQty);
        product.onHandQty = line.closingQty;
        product.avgUnitCost = calc2.avgUnitCost;
        totalValueUsed += calc2.usedValue;
        totalValueWasted += calc2.wastageValue;
        items.push({
          itemType: 'PRODUCT',
          productId: product.id,
          name: product.name,
          unit: product.baseUnit,
          openingQty: openQty,
          receivedQty,
          wastageQty,
          availableQty: calc2.availableQty,
          closingQty: line.closingQty,
          usedQty: calc2.usedQty,
          avgUnitCost: calc2.avgUnitCost,
          usedValue: calc2.usedValue,
          wastageValue: calc2.wastageValue,
          closingValue: calc2.closingValue,
        });
      } else {
        const m = this.makelineProducts.find((x) => x.id === line.makelineProductId);
        if (!m) throw new Error('Makeline product missing');
        const lastItem = last?.items.find(
          (i) => i.itemType === 'MAKELINE' && i.makelineProductId === m.id,
        );
        const producedQty = this.makelineProduction
          .filter((p) => p.makelineProductId === m.id && p.producedAt >= input.periodStart)
          .reduce((s, p) => s + p.quantity, 0);
        const wastageQty = this.wastage
          .filter((w) => w.makelineProductId === m.id && w.wastedOn >= input.periodStart)
          .reduce((s, w) => s + w.quantityBase, 0);
        const openQty = lastItem?.closingQty ?? m.onHandQty - producedQty + wastageQty;
        const calc = calculateMakelineClosingLine({
          openingQty: openQty,
          producedQty,
          wastageQty,
          closingQty: line.closingQty,
        });
        assertClosingNotAboveAvailable(m.name, line.closingQty, calc.availableQty);
        m.onHandQty = line.closingQty;
        items.push({
          itemType: 'MAKELINE',
          makelineProductId: m.id,
          name: m.name,
          unit: m.unit,
          openingQty: openQty,
          receivedQty: producedQty,
          wastageQty,
          availableQty: calc.availableQty,
          closingQty: line.closingQty,
          usedQty: calc.usedQty,
        });
      }
    }

    if (input.correctionOfId) {
      const prev = this.closings.find((c) => c.id === input.correctionOfId);
      if (prev) prev.status = 'SUPERSEDED';
    }

    this.closingSeq += 1;
    const session: ClosingSession = {
      id: randomUUID(),
      closingNo: `CLS-${input.periodEnd.replace(/-/g, '')}-${String(this.closingSeq).padStart(3, '0')}`,
      status: 'SUBMITTED',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      items,
      totalValueUsed,
      totalValueWasted,
      version: input.correctionOfId ? (this.closings.find((c) => c.id === input.correctionOfId)?.version ?? 0) + 1 : 1,
      supersedesId: input.correctionOfId,
      correctionReason: input.correctionReason,
      idempotencyKey: input.idempotencyKey,
      submittedById: input.submittedById,
      submittedAt: new Date().toISOString(),
    };
    this.closings.push(session);
    this.log('CLOSING_SUBMITTED', 'stock_closing', session.id, input.submittedById, input.correctionReason);
    return session;
  }

  // ─── Menu ─────────────────────────────────────────────────────
  setMenuPrice(menuItemId: string, newPrice: number, userId?: string) {
    const item = this.menuItems.find((m) => m.id === menuItemId);
    if (!item) throw new Error('Menu item not found');
    const old = item.price;
    item.price = newPrice;
    this.priceHistory.push({
      menuItemId,
      oldPrice: old,
      newPrice,
      changedAt: new Date().toISOString(),
    });
    this.log('MENU_PRICE_CHANGED', 'menu_item', menuItemId, userId);
    return item;
  }

  // ─── POS ──────────────────────────────────────────────────────
  createOrder(input: {
    orderType: string;
    cashierId: string;
    idempotencyKey: string;
    tableNo?: string;
    deliveryRef?: string;
    lines: Array<{ menuItemId: string; quantity: number; notes?: string }>;
    payments: Payment[];
  }): { order: Order; ticket?: KitchenTicket } {
    const existing = this.orders.find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) {
      return { order: existing, ticket: this.tickets.find((t) => t.orderId === existing.id) };
    }
    const type = this.orderTypes.find((t) => t.name === input.orderType);
    if (!type) throw new Error('Invalid order type');
    if (type.requiresReference && !input.deliveryRef) {
      throw new Error('Delivery platform reference required');
    }

    const rate = this.vat.enabled ? this.vat.ratePercent : 0;
    const mode: VatMode = this.vat.pricesIncludeVat ? 'INCLUSIVE' : 'EXCLUSIVE';
    const lines: OrderLine[] = input.lines.map((l) => {
      const mi = this.menuItems.find((m) => m.id === l.menuItemId);
      if (!mi || !mi.isActive || !mi.isAvailable) throw new Error(`Item unavailable: ${l.menuItemId}`);
      const lineTotal = mi.price * l.quantity;
      const vatRate = mi.vatClass === 'STANDARD' ? rate : 0;
      const v = lineVat(lineTotal, vatRate, mode);
      return {
        menuItemId: mi.id,
        nameSnapshot: mi.name,
        quantity: l.quantity,
        unitPrice: mi.price,
        lineTotal: v.total,
        vatAmount: v.vat,
        notes: l.notes,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const vatTotal = lines.reduce((s, l) => s + l.vatAmount, 0);
    const grandTotal = subtotal;
    const paid = input.payments.reduce((s, p) => s + p.amount, 0);
    let paymentStatus: Order['paymentStatus'] = 'UNPAID';
    if (paid <= 0) paymentStatus = 'UNPAID';
    else if (paid + 0.001 < grandTotal) paymentStatus = 'PARTIALLY_PAID';
    else paymentStatus = 'PAID';

    this.orderSeq += 1;
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const order: Order = {
      id: randomUUID(),
      orderNo: `ORD-${day}-${String(this.orderSeq).padStart(4, '0')}`,
      orderType: input.orderType,
      status: 'NEW',
      paymentStatus,
      lines,
      payments: input.payments,
      subtotal,
      vatTotal,
      grandTotal,
      vatMode: mode,
      vatRate: rate,
      cashierId: input.cashierId,
      tableNo: input.tableNo,
      deliveryRef: input.deliveryRef,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.orders.push(order);
    this.ticketSeq += 1;
    const ticket: KitchenTicket = {
      id: randomUUID(),
      orderId: order.id,
      ticketNo: String(this.ticketSeq).padStart(4, '0'),
      status: 'NEW',
      printCount: 1,
      createdAt: order.createdAt,
    };
    this.tickets.push(ticket);
    this.log('ORDER_CREATED', 'order', order.id, input.cashierId);
    return { order, ticket };
  }

  updateTicketStatus(ticketId: string, status: Order['status'], userId?: string) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.status = status;
    const now = new Date().toISOString();
    if (status === 'PREPARING') ticket.preparingAt = now;
    if (status === 'READY') ticket.readyAt = now;
    if (status === 'SERVED' || status === 'COLLECTED') ticket.servedAt = now;
    const order = this.orders.find((o) => o.id === ticket.orderId);
    if (order) order.status = status;
    this.log('TICKET_STATUS', 'kitchen_ticket', ticketId, userId, status);
    return ticket;
  }

  voidOrder(orderId: string, reason: string, userId?: string) {
    if (!reason?.trim()) throw new Error('Void reason required');
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');
    order.status = 'CANCELLED';
    order.voidReason = reason;
    order.paymentStatus = order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus;
    const ticket = this.tickets.find((t) => t.orderId === orderId);
    if (ticket) ticket.status = 'CANCELLED';
    this.log('ORDER_VOIDED', 'order', orderId, userId, reason);
    return order;
  }

  // ─── Reports ──────────────────────────────────────────────────
  salesReport(from: string, to: string) {
    const rows = this.orders.filter(
      (o) => o.createdAt.slice(0, 10) >= from && o.createdAt.slice(0, 10) <= to && o.status !== 'CANCELLED',
    );
    const gross = rows.reduce((s, o) => s + o.grandTotal, 0);
    const vat = rows.reduce((s, o) => s + o.vatTotal, 0);
    return {
      orders: rows.length,
      grossSales: gross,
      vatCollected: vat,
      netSales: gross - vat,
      averageOrder: rows.length ? gross / rows.length : 0,
      byOrderType: Object.fromEntries(
        this.orderTypes.map((t) => [
          t.name,
          rows.filter((o) => o.orderType === t.name).reduce((s, o) => s + o.grandTotal, 0),
        ]),
      ),
      note: 'Stock used value is not profit. Excludes wages, rent, utilities.',
    };
  }

  dashboard() {
    const today = new Date().toISOString().slice(0, 10);
    const sales = this.salesReport(today, today);
    const lastClose = [...this.closings]
      .filter((c) => c.status === 'SUBMITTED')
      .sort((a, b) => (a.submittedAt! < b.submittedAt! ? 1 : -1))[0];
    const lowStock = this.products.filter((p) => p.onHandQty <= p.minStock && p.isActive);
    return {
      todaySales: sales.grossSales,
      todayOrders: sales.orders,
      averageOrderValue: sales.averageOrder,
      salesByOrderType: sales.byOrderType,
      lastClosingValueUsed: lastClose?.totalValueUsed ?? 0,
      lastClosingValueWasted: lastClose?.totalValueWasted ?? 0,
      lowStock: lowStock.map((p) => ({ name: p.name, onHand: p.onHandQty, min: p.minStock })),
      note: 'Stock used value is utilisation cost, not profit.',
    };
  }
}

/** Seed sample data matching blueprint spirit (fictional). */
export function seedDemoStore(): InariStore {
  const store = new InariStore();
  const admin: User = {
    id: randomUUID(),
    fullName: 'Simon Keya',
    email: 'keya8020@gmail.com',
    passwordHash: 'hashed:keya2000',
    role: 'ADMINISTRATOR',
    isActive: true,
  };
  const manager: User = {
    id: randomUUID(),
    fullName: 'Mercy A.',
    email: 'manager@inarikicchin.test',
    passwordHash: 'hashed:manager1',
    role: 'MANAGER',
    isActive: true,
  };
  const cashier: User = {
    id: randomUUID(),
    fullName: 'James K.',
    email: 'cashier@inarikicchin.test',
    passwordHash: 'hashed:cashier1',
    role: 'CASHIER',
    isActive: true,
  };
  const kitchen: User = {
    id: randomUUID(),
    fullName: 'Chef O.',
    email: 'kitchen@inarikicchin.test',
    passwordHash: 'hashed:kitchen1',
    role: 'KITCHEN_STAFF',
    isActive: true,
  };
  store.users.push(admin, manager, cashier, kitchen);

  const chicken: Product = {
    id: randomUUID(),
    name: 'Chicken Breast',
    baseUnit: 'kg',
    minStock: 5,
    onHandQty: 10,
    avgUnitCost: 500,
    isActive: true,
  };
  const oil: Product = {
    id: randomUUID(),
    name: 'Cooking Oil',
    baseUnit: 'l',
    minStock: 4,
    onHandQty: 12,
    avgUnitCost: 290,
    isActive: true,
  };
  const tomatoes: Product = {
    id: randomUUID(),
    name: 'Tomatoes',
    baseUnit: 'kg',
    minStock: 3,
    onHandQty: 8,
    avgUnitCost: 110,
    isActive: true,
  };
  store.products.push(chicken, oil, tomatoes);

  const sauce: MakelineProduct = {
    id: randomUUID(),
    name: 'House Sauce',
    unit: 'l',
    onHandQty: 2,
    isActive: true,
  };
  store.makelineProducts.push(sauce);

  store.suppliers.push({ id: randomUUID(), name: 'Fresh Farm Supplies', isActive: true });

  const cat = { id: randomUUID(), name: 'Mains', sortOrder: 1 };
  store.menuCategories.push(cat);
  store.menuItems.push({
    id: randomUUID(),
    name: 'Grilled Chicken & Chips',
    categoryId: cat.id,
    price: 1250,
    isAvailable: true,
    isActive: true,
    vatClass: 'STANDARD',
  });
  store.menuItems.push({
    id: randomUUID(),
    name: 'Vanilla Shake',
    categoryId: cat.id,
    price: 450,
    isAvailable: true,
    isActive: true,
    vatClass: 'STANDARD',
  });

  return store;
}
