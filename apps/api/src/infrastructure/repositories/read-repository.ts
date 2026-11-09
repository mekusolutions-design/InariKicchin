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
      onHandQty: Number(m.on_hand_qty),
      isActive: m.is_active,
    }));
  }

  async menu() {
    const categories = await this.prisma.menuCategory.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      include: {
        items: {
          where: { is_active: true },
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
          categoryName: c.name,
          price: Number(m.price),
          isAvailable: m.is_available,
          description: m.description,
          itemCode: m.item_code,
        })),
      ),
    };
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
      include: { lines: true, payments: true, kitchen_tickets: true },
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

  async meta() {
    const [orderTypes, paymentMethods, vat, users] = await Promise.all([
      this.prisma.orderType.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
      this.prisma.paymentMethod.findMany({ where: { is_active: true } }),
      this.prisma.vatSetting.findFirst({ orderBy: { effective_from: 'desc' } }),
      this.prisma.user.findMany({
        where: { is_active: true },
        orderBy: { full_name: 'asc' },
        select: { id: true, full_name: true, email: true, role: true },
      }),
    ]);
    const ratePercent = vat ? Number(vat.rate_percent) : 16;
    return {
      orderTypes: orderTypes.map((o) => ({
        name: o.name,
        isDelivery: o.is_delivery,
        requiresReference: o.requires_reference,
      })),
      paymentMethods: paymentMethods.map((p) => p.name),
      vat: {
        enabled: vat ? true : true,
        ratePercent,
        // decimal form retained for POS/VAT helpers that expect 0.16
        rate: ratePercent / 100,
        pricesIncludeVat: vat ? vat.prices_include_vat : true,
      },
      users: users.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        role: u.role,
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
        include: { lines: true, payments: true, kitchen_tickets: true },
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
      platformReference: o.delivery_ref,
      subtotal: Number(o.subtotal),
      vatAmount: Number(o.vat_total),
      totalAmount: Number(o.grand_total),
      cashierId: o.cashier_id,
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
}
