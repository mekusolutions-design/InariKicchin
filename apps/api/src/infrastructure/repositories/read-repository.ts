/**
 * Read-side Prisma queries shaped for existing frontend contracts.
 */
import type { PrismaClient } from '@prisma/client';

export class ReadRepository {
  private readonly prisma: PrismaClient;
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async products() {
    const rows = await this.prisma.product.findMany({
      where: { is_active: true },
      include: { base_unit: true, category: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      baseUnit: p.base_unit.code,
      minStock: Number(p.min_stock_level),
      onHandQty: Number(p.on_hand_qty),
      avgUnitCost: Number(p.avg_unit_cost),
      isActive: p.is_active,
      categoryId: p.category_id,
      categoryName: p.category?.name,
      kind: 'purchased' as const,
    }));
  }

  async makelineProducts() {
    const rows = await this.prisma.makelineProduct.findMany({
      where: { is_active: true },
      include: { unit: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit.code,
      baseUnit: m.unit.code,
      onHandQty: Number(m.on_hand_qty),
      available: Number(m.on_hand_qty),
      avgUnitCost: 0,
      isActive: m.is_active,
      kind: 'makeline' as const,
    }));
  }

  async menu() {
    const categories = await this.prisma.menuCategory.findMany({
      orderBy: { sort_order: 'asc' },
      include: {
        items: {
          orderBy: { name: 'asc' },
        },
      },
    });
    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sort_order,
      })),
      items: categories.flatMap((c) =>
        c.items.map((m) => ({
          id: m.id,
          name: m.name,
          categoryId: m.category_id,
          category: c.name,
          categoryName: c.name,
          price: Number(m.price),
          isAvailable: m.is_available,
          isActive: m.is_active,
          description: m.description,
          code: m.item_code,
          itemCode: m.item_code,
        })),
      ),
    };
  }


  async purchases(limit = 50) {
    const rows = await this.prisma.purchase.findMany({
      take: limit,
      orderBy: { date_received: 'desc' },
      include: { items: { include: { product: true, unit: true } }, supplier: true },
    });
    const out: Array<Record<string, unknown>> = [];
    for (const pur of rows) {
      for (const i of pur.items) {
        out.push({
          id: i.id,
          dateReceived: pur.date_received?.toISOString?.() ?? pur.date_received,
          productName: i.product?.name ?? '',
          quantity: Number(i.quantity),
          unit: i.unit?.code ?? '',
          totalPrice: Number(i.total_price),
          unitPrice: Number(i.unit_price),
          supplierName: pur.supplier?.name ?? '',
          invoiceNumber: pur.invoice_no,
        });
      }
    }
    return out;
  }

  async suppliers() {
    const rows = await this.prisma.supplier.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contact_person,
      phone: s.phone,
      email: s.email,
      isActive: s.is_active,
    }));
  }

  async orders(limit = 100) {
    const rows = await this.prisma.restaurantOrder.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { lines: true, payments: true, kitchen_tickets: true, cashier: true },
    });
    return rows.map((o) => this.mapOrder(o));
  }

  async kitchenTickets() {
    const rows = await this.prisma.kitchenTicket.findMany({
      where: { status: { not: 'CANCELLED' } },
      orderBy: { created_at: 'asc' },
      include: { order: { include: { lines: true } } },
    });
    return rows.map((t) => ({
      id: t.id,
      orderId: t.order_id,
      orderNo: t.order.order_no,
      ticketNo: t.ticket_no,
      status: t.status,
      createdAt: t.created_at.toISOString(),
      preparingAt: t.preparing_at?.toISOString(),
      readyAt: t.ready_at?.toISOString(),
      lines: t.order.lines.map((l) => ({
        name: l.name_snapshot,
        quantity: Number(l.quantity),
        notes: l.notes,
      })),
    }));
  }

  async closings(limit = 50) {
    const rows = await this.prisma.stockClosingSession.findMany({
      take: limit,
      orderBy: { submitted_at: 'desc' },
      include: { items: true },
    });
    return rows.map((s) => ({
      id: s.id,
      closingNo: s.closing_no,
      status: s.status,
      periodStart: s.period_start.toISOString(),
      periodEnd: s.period_end.toISOString(),
      totalValueUsed: Number(s.total_value_used),
      totalValueWasted: Number(s.total_value_wasted),
      submittedAt: s.submitted_at?.toISOString(),
      items: s.items.map((i) => ({
        itemType: i.item_type,
        productId: i.product_id,
        makelineProductId: i.makeline_product_id,
        name: i.name_snapshot,
        unit: i.unit_snapshot,
        openingQty: Number(i.opening_qty),
        receivedQty: Number(i.received_qty),
        wastageQty: Number(i.wastage_qty),
        availableQty: Number(i.available_qty),
        closingQty: Number(i.closing_qty),
        usedQty: Number(i.used_qty),
        avgUnitCost: i.avg_unit_cost != null ? Number(i.avg_unit_cost) : undefined,
        usedValue: i.used_value != null ? Number(i.used_value) : undefined,
      })),
    }));
  }

  async audit(limit = 200) {
    const rows = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
    });
    return rows.map((a) => ({
      id: a.id,
      userId: a.user_id,
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      reason: a.reason,
      createdAt: a.created_at.toISOString(),
    }));
  }


  async getSettings() {
    const rows = await this.prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    const defaults: Record<string, string> = {
      module_dine_pickup_delivery: '1',
      module_table_number: '1',
      module_kitchen_tickets: '1',
      module_print_receipt: '1',
      module_discounts: '0',
      module_makeline_deductions: '0',
      module_low_stock_alerts: '1',
      receipt_note: 'Thank you for dining with us',
      receipt_business_name: 'Inari Kicchin',
      receipt_address: '',
      receipt_phone: '',
      receipt_kra_pin: '',
      receipt_vat_number: '',
      receipt_paper_width: '80',
      paybill_business_number: '',
      paybill_account_format: 'ORDER',
      paybill_till_number: '',
      bank_name: '',
      bank_account: '',
      payment_instruction: '',
      print_payment_box: '1',
      vat_enabled: '1',
      vat_rate: '16',
      vat_inclusive: '1',
    };
    return { ...defaults, ...map };
  }

  async putSettings(input: { settings: Record<string, string>; userId?: string }) {
    const entries = Object.entries(input.settings ?? {}).filter(
      ([key, value]) => key && typeof value === 'string',
    );
    for (const [key, value] of entries) {
      if (key === 'receipt_note' && value.length > 200) {
        throw new Error('Receipt note max 200 characters');
      }
    }

    // Sequential upserts — avoid interactive $transaction on PgBouncer pooler
    // (Supabase :6543), which causes "Transaction not found / old closed transaction".
    for (const [key, value] of entries) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updated_by: input.userId },
        update: { value, updated_by: input.userId },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'SETTINGS_UPDATED',
        entity_type: 'system_setting',
        new_values: input.settings,
      },
    });

    return this.getSettings();
  }

  async posOrderReport(from: string, to: string) {
    const start = new Date(`${from}T00:00:00+03:00`);
    const end = new Date(`${to}T23:59:59.999+03:00`);
    const rows = await this.prisma.restaurantOrder.findMany({
      where: {
        created_at: { gte: start, lte: end },
      },
      include: { lines: true, payments: true, cashier: true },
      orderBy: { created_at: 'asc' },
    });
    const active = rows.filter((o) => o.status !== 'CANCELLED');
    const voided = rows.filter((o) => o.status === 'CANCELLED');
    const gross = active.reduce((s, o) => s + Number(o.grand_total), 0);
    const vat = active.reduce((s, o) => s + Number(o.vat_total), 0);
    const byPayment: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    for (const o of active) {
      byType[o.order_type] = (byType[o.order_type] ?? 0) + Number(o.grand_total);
      const hour = new Date(o.created_at).toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        hour12: false,
      });
      byHour[hour] = (byHour[hour] ?? 0) + Number(o.grand_total);
      for (const p of o.payments) {
        if (p.status === 'CONFIRMED' || p.status === 'PENDING') {
          byPayment[p.method_name] = (byPayment[p.method_name] ?? 0) + Number(p.amount);
        }
      }
    }
    return {
      from,
      to,
      timezone: 'Africa/Nairobi',
      orderCount: active.length,
      voidCount: voided.length,
      grossSales: gross,
      vatCollected: vat,
      netSales: gross - vat,
      averageOrder: active.length ? gross / active.length : 0,
      byPaymentMethod: byPayment,
      byOrderType: byType,
      byHour,
      orders: rows.map((o) => this.mapOrder(o)),
      voids: voided.map((o) => this.mapOrder(o)),
      dayClose: {
        expectedCash: byPayment['Cash'] ?? 0,
        mpesa: byPayment['M-Pesa'] ?? 0,
        card: byPayment['Card'] ?? 0,
        bank: byPayment['Bank'] ?? 0,
        platformUnsettled: Object.entries(byPayment)
          .filter(([k]) => k.startsWith('Platform'))
          .reduce((s, [, v]) => s + v, 0),
        voids: voided.length,
      },
    };
  }

  async meta() {
    const [orderTypes, paymentMethods, vat, users, settings] = await Promise.all([
      this.prisma.orderType.findMany({ orderBy: { sort_order: 'asc' } }),
      this.prisma.paymentMethod.findMany({ where: { is_active: true } }),
      this.prisma.vatSetting.findFirst({ orderBy: { effective_from: 'desc' } }),
      this.prisma.user.findMany({
        where: { is_active: true },
        orderBy: { full_name: 'asc' },
        select: { id: true, full_name: true, email: true, role: true, is_active: true },
      }),
      this.prisma.systemSetting.findMany(),
    ]);
    const sMap: Record<string, string> = {};
    for (const r of settings) sMap[r.key] = r.value;
    const rateFromSettings = sMap.vat_rate ? Number(sMap.vat_rate) : NaN;
    const ratePercent = Number.isFinite(rateFromSettings)
      ? rateFromSettings
      : vat
        ? Number(vat.rate_percent)
        : 16;
    const enabled = sMap.vat_enabled !== undefined ? sMap.vat_enabled !== '0' : true;
    const pricesIncludeVat =
      sMap.vat_inclusive !== undefined
        ? sMap.vat_inclusive !== '0'
        : vat
          ? vat.prices_include_vat
          : true;
    return {
      orderTypes: orderTypes.map((o) => ({
        name: o.name,
        isDelivery: o.is_delivery,
        requiresReference: o.requires_reference,
        isActive: o.is_active,
      })),
      paymentMethods: paymentMethods.map((p) => p.name),
      vat: {
        enabled,
        ratePercent,
        rate: ratePercent / 100,
        pricesIncludeVat,
      },
      users: users.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        role: u.role,
        isActive: u.is_active,
      })),
      durable: true,
    };
  }

  async dashboard() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayOrders, allProducts, wastageToday, openTickets, lastClosing, purchasesToday] =
      await Promise.all([
        this.prisma.restaurantOrder.findMany({
          where: { created_at: { gte: todayStart }, status: { not: 'CANCELLED' } },
          include: { payments: true },
        }),
        this.prisma.product.findMany({ where: { is_active: true }, include: { base_unit: true } }),
        this.prisma.wastageRecord.count({ where: { wasted_on: { gte: todayStart } } }),
        this.prisma.kitchenTicket.count({
          where: { status: { in: ['NEW', 'PREPARING'] } },
        }),
        this.prisma.stockClosingSession.findFirst({
          where: { status: 'SUBMITTED' },
          orderBy: { submitted_at: 'desc' },
        }),
        this.prisma.purchase.findMany({
          where: { date_received: { gte: todayStart } },
          include: { items: true },
        }),
      ]);

    const low = allProducts.filter((p) => Number(p.on_hand_qty) <= Number(p.min_stock_level));
    const salesTotal = todayOrders.reduce((s, o) => s + Number(o.grand_total), 0);
    const orderCount = todayOrders.length;
    const byPayment: Record<string, number> = {};
    const byOrderType: Record<string, number> = {};
    for (const o of todayOrders) {
      byOrderType[o.order_type] = (byOrderType[o.order_type] ?? 0) + Number(o.grand_total);
      for (const p of o.payments) {
        if (p.status === 'CONFIRMED') {
          byPayment[p.method_name] = (byPayment[p.method_name] ?? 0) + Number(p.amount);
        }
      }
    }
    const stockReceivedToday = purchasesToday.reduce(
      (s, p) => s + p.items.reduce((is, i) => is + Number(i.total_price), 0),
      0,
    );

    return {
      todaySales: salesTotal,
      todayOrders: orderCount,
      averageOrderValue: orderCount ? salesTotal / orderCount : 0,
      salesByPaymentMethod: byPayment,
      salesByOrderType: Object.entries(byOrderType).map(([type, value]) => ({ type, value })),
      stockReceivedToday,
      lastClosingValueUsed: lastClosing ? Number(lastClosing.total_value_used) : 0,
      lastClosingValueWasted: lastClosing ? Number(lastClosing.total_value_wasted) : 0,
      lowStock: low.map((p) => ({
        id: p.id,
        name: p.name,
        onHand: Number(p.on_hand_qty),
        onHandQty: Number(p.on_hand_qty),
        min: Number(p.min_stock_level),
        minStock: Number(p.min_stock_level),
        unit: p.base_unit?.code,
      })),
      wastageTodayCount: wastageToday,
      openKitchenTickets: openTickets,
      note: 'Stock used value is utilisation cost, not profit.',
    };
  }

  async salesReport(from: string, to: string) {
    const [rows, closings] = await Promise.all([
      this.prisma.restaurantOrder.findMany({
        where: {
          created_at: { gte: new Date(from), lte: new Date(`${to}T23:59:59.999Z`) },
          status: { not: 'CANCELLED' },
        },
        include: { lines: true, payments: true, kitchen_tickets: true, cashier: true },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.stockClosingSession.findMany({
        where: {
          status: 'SUBMITTED',
          submitted_at: {
            gte: new Date(from),
            lte: new Date(`${to}T23:59:59.999Z`),
          },
        },
      }),
    ]);
    const gross = rows.reduce((s, o) => s + Number(o.grand_total), 0);
    const vat = rows.reduce((s, o) => s + Number(o.vat_total), 0);
    const byOrderType: Record<string, number> = {};
    for (const o of rows) {
      byOrderType[o.order_type] = (byOrderType[o.order_type] ?? 0) + Number(o.grand_total);
    }
    const stockUsedValue = closings.reduce((s, c) => s + Number(c.total_value_used), 0);
    const wastageValue = closings.reduce((s, c) => s + Number(c.total_value_wasted), 0);
    return {
      from,
      to,
      // Frontend contract (also used by in-memory store)
      orders: rows.length,
      grossSales: gross,
      vatCollected: vat,
      netSales: gross - vat,
      averageOrder: rows.length ? gross / rows.length : 0,
      byOrderType,
      stockUsedValue,
      wastageValue,
      note: 'Stock used value is utilisation cost, not profit. Excludes wages, rent, utilities.',
      // Detail retained for CSV / advanced consumers
      orderCount: rows.length,
      totalSales: gross,
      totalVat: vat,
      orderRows: rows.map((o) => this.mapOrder(o)),
    };
  }

  private mapOrder(o: any) {
    return {
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      paymentStatus: o.payment_status,
      orderType: o.order_type,
      tableNo: o.table_no,
      platformReference: o.delivery_ref,
      subtotal: Number(o.subtotal),
      vatAmount: Number(o.vat_total),
      totalAmount: Number(o.grand_total),
      cashierId: o.cashier_id,
      cashierName: o.cashier?.full_name,
      createdAt: o.created_at?.toISOString?.() ?? o.created_at,
      lines: (o.lines ?? []).map((l: any) => ({
        id: l.id,
        menuItemId: l.menu_item_id,
        name: l.name_snapshot,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unit_price),
        lineTotal: Number(l.line_total),
        vatAmount: Number(l.vat_amount),
        notes: l.notes,
      })),
      payments: (o.payments ?? []).map((p: any) => ({
        id: p.id,
        method: p.method_name,
        amount: Number(p.amount),
        status: p.status,
        reference: p.reference,
      })),
      kitchenTicketId: o.kitchen_tickets?.[0]?.id,
    };
  }

  async salesReportCsv(from: string, to: string): Promise<string> {
    const report = await this.salesReport(from, to);
    const header = ['orderNo', 'createdAt', 'orderType', 'status', 'paymentStatus', 'subtotal', 'vatAmount', 'totalAmount', 'cashierId'];
    const lines = [header.join(',')];
    const detail = (report as { orderRows?: any[] }).orderRows ?? [];
    for (const o of detail) {
      lines.push([
        o.orderNo,
        o.createdAt,
        o.orderType,
        o.status,
        o.paymentStatus,
        o.subtotal.toFixed(2),
        o.vatAmount.toFixed(2),
        o.totalAmount.toFixed(2),
        o.cashierId,
      ].map((v) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    }
    lines.push(`TOTALS,,,${report.orderCount},,${report.totalSales.toFixed(2)},${report.totalVat.toFixed(2)},,`);
    return lines.join('\n') + '\n';
  }

  async supplierAnalytics(from: string, to: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        date_received: {
          gte: new Date(from),
          lte: new Date(`${to}T23:59:59.999Z`),
        },
      },
      include: { items: true, supplier: true },
    });
    const bySupplier = new Map<string, { supplierId: string; supplierName: string; purchaseCount: number; totalSpend: number; items: number }>();
    for (const p of purchases) {
      const spend = p.items.reduce((s, i) => s + Number(i.total_price), 0);
      const cur = bySupplier.get(p.supplier_id) ?? {
        supplierId: p.supplier_id,
        supplierName: p.supplier?.name ?? p.supplier_id,
        purchaseCount: 0,
        totalSpend: 0,
        items: 0,
      };
      cur.purchaseCount += 1;
      cur.totalSpend += spend;
      cur.items += p.items.length;
      bySupplier.set(p.supplier_id, cur);
    }
    return [...bySupplier.values()].map((s) => ({
      ...s,
      totalSpend: Math.round(s.totalSpend * 100) / 100,
    }));
  }

  async etimsReceipt(orderId: string) {
    const order = await this.prisma.restaurantOrder.findUnique({
      where: { id: orderId },
      include: { lines: true, payments: true },
    });
    if (!order) return null;
    const kra = await this.prisma.systemSetting.findUnique({ where: { key: 'restaurant_kra_pin' } });
    return {
      kraPin: kra?.value ?? 'P0XXXXXXXXX',
      invoiceNumber: order.order_no,
      timestamp: order.created_at.toISOString(),
      lines: order.lines.map((l) => ({
        name: l.name_snapshot,
        qty: Number(l.quantity),
        unitPrice: Number(l.unit_price),
        lineTotal: Number(l.line_total),
        vatAmount: Number(l.vat_amount),
      })),
      subtotal: Number(order.subtotal),
      vatTotal: Number(order.vat_total),
      grandTotal: Number(order.grand_total),
      paymentMethod: order.payments.map((p) => p.method_name).join('+') || 'UNPAID',
      etimsReady: true as const,
      etimsSubmitted: false as const,
    };
  }

}

// --- Admin write helpers (schema-aligned) ---

export class CatalogRepository {
  private readonly prisma: import('@prisma/client').PrismaClient;
  constructor(prisma: import('@prisma/client').PrismaClient) {
    this.prisma = prisma;
  }


  async createMakelineProduct(input: {
    name: string;
    unitCode: string;
    notes?: string;
    userId?: string;
  }) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('Makeline product name is required');
    const unit = await this.prisma.unit.findUnique({ where: { code: input.unitCode } });
    if (!unit) throw new Error(`Unknown unit: ${input.unitCode}`);
    const existing = await this.prisma.makelineProduct.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new Error(`Makeline product “${existing.name}” already exists`);
    const row = await this.prisma.makelineProduct.create({
      data: {
        name,
        unit_id: unit.id,
        on_hand_qty: 0,
        is_active: true,
      },
      include: { unit: true },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'MAKELINE_PRODUCT_CREATED',
        entity_type: 'makeline_product',
        entity_id: row.id,
        new_values: { name: row.name, unit: unit.code },
      },
    });
    return {
      id: row.id,
      name: row.name,
      unit: row.unit.code,
      onHandQty: Number(row.on_hand_qty),
      isActive: row.is_active,
    };
  }


  async setMenuItemActive(input: { id: string; isActive: boolean; userId?: string }) {
    const active = Boolean(input.isActive);
    const row = await this.prisma.menuItem.update({
      where: { id: input.id },
      data: { is_active: active, is_available: active },
      include: { category: true },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: input.isActive ? 'MENU_ITEM_RESTORED' : 'MENU_ITEM_ARCHIVED',
        entity_type: 'menu_item',
        entity_id: row.id,
        new_values: { isActive: row.is_active },
      },
    });
    return {
      id: row.id,
      name: row.name,
      isActive: row.is_active,
      isAvailable: row.is_available,
      category: row.category.name,
      price: Number(row.price),
    };
  }


  async createUser(input: {
    fullName: string;
    email: string;
    password: string;
    role: 'ADMINISTRATOR' | 'MANAGER' | 'CASHIER' | 'KITCHEN_STAFF';
    phone?: string;
    actorId?: string;
    actorRole?: string;
  }) {
    const fullName = String(input.fullName ?? '').trim();
    const email = String(input.email ?? '').trim().toLowerCase();
    const password = String(input.password ?? '');
    if (fullName.length < 2) throw new Error('Full name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid email is required');
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    const allowed = new Set(['ADMINISTRATOR', 'MANAGER', 'CASHIER', 'KITCHEN_STAFF']);
    if (!allowed.has(input.role)) throw new Error('Invalid role');
    if (input.role === 'ADMINISTRATOR' && input.actorRole !== 'ADMINISTRATOR') {
      throw new Error('Only administrators can create administrator accounts');
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('A user with this email already exists');
    const { randomBytes, scryptSync } = await import('node:crypto');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    const row = await this.prisma.user.create({
      data: {
        full_name: fullName,
        email,
        phone: input.phone?.trim() || null,
        password_hash: `scrypt:${salt}:${hash}`,
        role: input.role,
        is_active: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.actorId,
        action: 'USER_CREATED',
        entity_type: 'user',
        entity_id: row.id,
        new_values: { email: row.email, role: row.role },
      },
    });
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
    };
  }

  async setUserActive(input: {
    userId: string;
    isActive: boolean;
    actorId?: string;
    actorRole?: string;
  }) {
    const target = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target) throw new Error('User not found');
    if (target.role === 'ADMINISTRATOR' && input.actorRole !== 'ADMINISTRATOR') {
      throw new Error('Cannot change administrator status');
    }
    if (input.actorId === target.id && !input.isActive) {
      throw new Error('Cannot deactivate your own account');
    }
    const row = await this.prisma.user.update({
      where: { id: input.userId },
      data: { is_active: input.isActive },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.actorId,
        action: input.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity_type: 'user',
        entity_id: row.id,
        new_values: { isActive: row.is_active },
      },
    });
    return { id: row.id, email: row.email, isActive: row.is_active, role: row.role };
  }

  async listOrderTypes() {
    const rows = await this.prisma.orderType.findMany({ orderBy: { sort_order: 'asc' } });
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      isDelivery: o.is_delivery,
      requiresReference: o.requires_reference,
      isActive: o.is_active,
      sortOrder: o.sort_order,
    }));
  }

  async upsertOrderType(input: {
    id?: string;
    name: string;
    isDelivery?: boolean;
    requiresReference?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    userId?: string;
  }) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('Order type name is required');
    const data = {
      name,
      is_delivery: Boolean(input.isDelivery),
      requires_reference: Boolean(input.requiresReference ?? input.isDelivery),
      is_active: input.isActive !== false,
      sort_order: input.sortOrder ?? 0,
    };
    let row;
    if (input.id) {
      row = await this.prisma.orderType.update({ where: { id: input.id }, data });
    } else {
      row = await this.prisma.orderType.upsert({
        where: { name },
        create: data,
        update: data,
      });
    }
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: input.id ? 'ORDER_TYPE_UPDATED' : 'ORDER_TYPE_UPSERTED',
        entity_type: 'order_type',
        entity_id: row.id,
        new_values: { name: row.name, isDelivery: row.is_delivery },
      },
    });
    return {
      id: row.id,
      name: row.name,
      isDelivery: row.is_delivery,
      requiresReference: row.requires_reference,
      isActive: row.is_active,
      sortOrder: row.sort_order,
    };
  }

  async setManagerPin(input: { pin: string; userId?: string }) {
    const pin = String(input.pin ?? '');
    if (!/^\d{4,8}$/.test(pin)) throw new Error('Manager PIN must be 4–8 digits');
    const { randomBytes, scryptSync } = await import('node:crypto');
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(pin, salt, 64).toString('hex');
    const value = `scrypt:${salt}:${hash}`;
    await this.prisma.systemSetting.upsert({
      where: { key: 'manager_authorization_pin_hash' },
      create: { key: 'manager_authorization_pin_hash', value, updated_by: input.userId },
      update: { value, updated_by: input.userId },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'MANAGER_PIN_SET',
        entity_type: 'system_setting',
        entity_id: 'manager_authorization_pin_hash',
      },
    });
    return { ok: true };
  }

  async verifyManagerPin(pin: string): Promise<boolean> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'manager_authorization_pin_hash' },
    });
    if (!row?.value?.startsWith('scrypt:')) return false;
    const [, salt, hash] = row.value.split(':');
    const { scryptSync, timingSafeEqual } = await import('node:crypto');
    const derived = scryptSync(String(pin), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }

  async createSupplier(input: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    userId?: string;
  }) {
    if (!input.name?.trim()) throw new Error('Supplier name is required');
    const row = await this.prisma.supplier.create({
      data: {
        name: input.name.trim(),
        contact_person: input.contactPerson ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'SUPPLIER_CREATED',
        entity_type: 'supplier',
        entity_id: row.id,
        new_values: { name: row.name },
      },
    });
    return {
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person,
      phone: row.phone,
      email: row.email,
      isActive: row.is_active,
    };
  }

  async createProduct(input: {
    name: string;
    baseUnitCode: string;
    categoryName?: string;
    minStock?: number;
    userId?: string;
  }) {
    if (!input.name?.trim()) throw new Error('Product name is required');
    const unit = await this.prisma.unit.findUnique({ where: { code: input.baseUnitCode } });
    if (!unit) throw new Error(`Unknown unit: ${input.baseUnitCode}`);
    let categoryId: string | null = null;
    if (input.categoryName?.trim()) {
      const cat = await this.prisma.productCategory.upsert({
        where: { name: input.categoryName.trim() },
        create: { name: input.categoryName.trim() },
        update: {},
      });
      categoryId = cat.id;
    } else {
      const cat = await this.prisma.productCategory.upsert({
        where: { name: 'General' },
        create: { name: 'General' },
        update: {},
      });
      categoryId = cat.id;
    }
    const row = await this.prisma.product.create({
      data: {
        name: input.name.trim(),
        category_id: categoryId,
        base_unit_id: unit.id,
        min_stock_level: input.minStock ?? 0,
        on_hand_qty: 0,
        avg_unit_cost: 0,
        is_active: true,
      },
      include: { base_unit: true, category: true },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'PRODUCT_CREATED',
        entity_type: 'product',
        entity_id: row.id,
        new_values: { name: row.name },
      },
    });
    return {
      id: row.id,
      name: row.name,
      baseUnit: row.base_unit.code,
      minStock: Number(row.min_stock_level),
      onHandQty: Number(row.on_hand_qty),
      avgUnitCost: Number(row.avg_unit_cost),
      isActive: row.is_active,
      categoryId: row.category_id,
      categoryName: row.category?.name,
    };
  }

  async ensureCategory(name: string) {
    const n = String(name ?? '').trim();
    if (!n) throw new Error('Category name is required');
    const existing = await this.prisma.menuCategory.findFirst({
      where: { name: { equals: n, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return this.prisma.menuCategory.create({
      data: { name: n, sort_order: 0, is_active: true },
    });
  }

  async createMenuItem(input: {
    name: string;
    code?: string;
    category: string;
    price: number;
    description?: string;
    isAvailable?: boolean;
    userId?: string;
  }) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('Menu item name is required');
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be greater than zero');
    const code = input.code?.trim() || null;
    if (code) {
      const codeClash = await this.prisma.menuItem.findFirst({ where: { item_code: code } });
      if (codeClash) throw new Error(`Item code “${code}” is already used`);
    }
    const nameClash = await this.prisma.menuItem.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, is_active: true },
    });
    if (nameClash) throw new Error(`Menu item “${nameClash.name}” already exists`);

    const category = await this.ensureCategory(input.category || 'Uncategorised');
    const available = input.isAvailable !== false;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          name,
          item_code: code,
          category_id: category.id,
          price,
          description: input.description?.trim() || null,
          is_available: available,
          is_active: true,
        },
        include: { category: true },
      });
      await tx.menuItemPriceHistory.create({
        data: {
          menu_item_id: created.id,
          old_price: price,
          new_price: price,
          changed_by_id: input.userId,
          reason: 'Initial price',
        },
      });
      await tx.auditLog.create({
        data: {
          user_id: input.userId,
          action: 'MENU_ITEM_CREATED',
          entity_type: 'menu_item',
          entity_id: created.id,
          new_values: { name, price, category: category.name },
        },
      });
      return created;
    });

    return {
      id: row.id,
      name: row.name,
      code: row.item_code,
      category: row.category.name,
      price: Number(row.price),
      description: row.description,
      isAvailable: row.is_available,
      isActive: row.is_active,
    };
  }

  async updateMenuItem(input: {
    id: string;
    name?: string;
    code?: string | null;
    category?: string;
    price?: number;
    description?: string | null;
    isAvailable?: boolean;
    userId?: string;
  }) {
    const existing = await this.prisma.menuItem.findUnique({
      where: { id: input.id },
      include: { category: true },
    });
    if (!existing) throw new Error('Menu item not found');

    let categoryId = existing.category_id;
    if (input.category) {
      const cat = await this.ensureCategory(input.category);
      categoryId = cat.id;
    }

    const newPrice = input.price !== undefined ? Number(input.price) : Number(existing.price);
    if (!Number.isFinite(newPrice) || newPrice <= 0) throw new Error('Price must be greater than zero');

    const name = input.name !== undefined ? String(input.name).trim() : existing.name;
    if (!name) throw new Error('Menu item name is required');

    const code = input.code !== undefined ? (input.code?.trim() || null) : existing.item_code;
    if (code) {
      const codeClash = await this.prisma.menuItem.findFirst({
        where: { item_code: code, NOT: { id: input.id } },
      });
      if (codeClash) throw new Error(`Item code “${code}” is already used`);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (Number(existing.price) !== newPrice) {
        await tx.menuItemPriceHistory.create({
          data: {
            menu_item_id: existing.id,
            old_price: existing.price,
            new_price: newPrice,
            changed_by_id: input.userId,
            reason: 'Price update',
          },
        });
      }
      const updated = await tx.menuItem.update({
        where: { id: input.id },
        data: {
          name,
          item_code: code,
          category_id: categoryId,
          price: newPrice,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : existing.description,
          is_available:
            input.isAvailable !== undefined ? Boolean(input.isAvailable) : existing.is_available,
        },
        include: { category: true },
      });
      await tx.auditLog.create({
        data: {
          user_id: input.userId,
          action: 'MENU_ITEM_UPDATED',
          entity_type: 'menu_item',
          entity_id: updated.id,
          old_values: { name: existing.name, price: Number(existing.price) },
          new_values: { name: updated.name, price: Number(updated.price) },
        },
      });
      return updated;
    });

    return {
      id: row.id,
      name: row.name,
      code: row.item_code,
      category: row.category.name,
      price: Number(row.price),
      description: row.description,
      isAvailable: row.is_available,
      isActive: row.is_active,
    };
  }

  async listCategories() {
    const rows = await this.prisma.menuCategory.findMany({
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order,
      isActive: c.is_active,
      itemCount: c._count.items,
    }));
  }

  async createCategory(input: { name: string; sortOrder?: number; userId?: string }) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('Category name is required');
    const existing = await this.prisma.menuCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new Error(`Category “${existing.name}” already exists`);
    const maxSort = await this.prisma.menuCategory.aggregate({ _max: { sort_order: true } });
    const row = await this.prisma.menuCategory.create({
      data: {
        name,
        sort_order: input.sortOrder ?? (maxSort._max.sort_order ?? 0) + 1,
        is_active: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'MENU_CATEGORY_CREATED',
        entity_type: 'menu_category',
        entity_id: row.id,
        new_values: { name: row.name },
      },
    });
    return { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active, itemCount: 0 };
  }

  async renameCategory(input: { id: string; name: string; userId?: string }) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new Error('Category name is required');
    const clash = await this.prisma.menuCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, NOT: { id: input.id } },
    });
    if (clash) throw new Error(`Category “${clash.name}” already exists`);
    const row = await this.prisma.menuCategory.update({
      where: { id: input.id },
      data: { name },
    });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'MENU_CATEGORY_RENAMED',
        entity_type: 'menu_category',
        entity_id: row.id,
        new_values: { name: row.name },
      },
    });
    return { id: row.id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active };
  }

  async listRecipeLines(makelineProductId?: string, menuItemId?: string) {
    const rows = await this.prisma.recipeLine.findMany({
      where: {
        ...(makelineProductId ? { output_makeline_id: makelineProductId } : {}),
        ...(menuItemId ? { output_menu_item_id: menuItemId } : {}),
      },
      include: {
        input_product: { include: { base_unit: true } },
        output_makeline: true,
        output_menu_item: true,
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      outputMakelineId: r.output_makeline_id,
      outputMenuItemId: r.output_menu_item_id,
      inputProductId: r.input_product_id,
      inputProductName: r.input_product?.name,
      inputUnit: r.input_product?.base_unit?.code,
      quantityPerUnit: Number(r.quantity),
    }));
  }

  async upsertRecipeLine(input: {
    outputMakelineId?: string;
    outputMenuItemId?: string;
    inputProductId: string;
    quantityPerUnit: number;
    userId?: string;
  }) {
    if (!input.outputMakelineId && !input.outputMenuItemId) {
      throw new Error('outputMakelineId or outputMenuItemId is required');
    }
    if (!input.inputProductId) throw new Error('inputProductId is required');
    const qty = Number(input.quantityPerUnit);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('quantityPerUnit must be positive');

    const existing = await this.prisma.recipeLine.findFirst({
      where: {
        input_product_id: input.inputProductId,
        output_makeline_id: input.outputMakelineId ?? null,
        output_menu_item_id: input.outputMenuItemId ?? null,
      },
    });
    const row = existing
      ? await this.prisma.recipeLine.update({
          where: { id: existing.id },
          data: { quantity: qty },
        })
      : await this.prisma.recipeLine.create({
          data: {
            output_makeline_id: input.outputMakelineId ?? null,
            output_menu_item_id: input.outputMenuItemId ?? null,
            input_product_id: input.inputProductId,
            quantity: qty,
          },
        });
    await this.prisma.auditLog.create({
      data: {
        user_id: input.userId,
        action: 'RECIPE_LINE_UPSERTED',
        entity_type: 'recipe_line',
        entity_id: row.id,
        new_values: {
          inputProductId: input.inputProductId,
          quantityPerUnit: qty,
          outputMakelineId: input.outputMakelineId,
          outputMenuItemId: input.outputMenuItemId,
        },
      },
    });
    return {
      id: row.id,
      outputMakelineId: row.output_makeline_id,
      outputMenuItemId: row.output_menu_item_id,
      inputProductId: row.input_product_id,
      quantityPerUnit: Number(row.quantity),
    };
  }

  async deleteRecipeLine(id: string, userId?: string) {
    await this.prisma.recipeLine.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'RECIPE_LINE_DELETED',
        entity_type: 'recipe_line',
        entity_id: id,
      },
    });
    return { ok: true };
  }
}
