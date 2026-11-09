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
    const [orderTypes, paymentMethods, vat] = await Promise.all([
      this.prisma.orderType.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
      this.prisma.paymentMethod.findMany({ where: { is_active: true } }),
      this.prisma.vatSetting.findFirst({ orderBy: { effective_from: 'desc' } }),
    ]);
    return {
      orderTypes: orderTypes.map((o) => ({
        name: o.name,
        isDelivery: o.is_delivery,
        requiresReference: o.requires_reference,
      })),
      paymentMethods: paymentMethods.map((p) => p.name),
      vat: vat
        ? {
            rate: Number(vat.rate_percent) / 100,
            pricesIncludeVat: vat.prices_include_vat,
          }
        : { rate: 0.16, pricesIncludeVat: true },
      durable: true,
    };
  }

  async dashboard() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayOrders, allProducts, wastageToday, openTickets] = await Promise.all([
      this.prisma.restaurantOrder.findMany({
        where: { created_at: { gte: todayStart }, status: { not: 'CANCELLED' } },
        include: { payments: true },
      }),
      this.prisma.product.findMany({ where: { is_active: true } }),
      this.prisma.wastageRecord.count({ where: { wasted_on: { gte: todayStart } } }),
      this.prisma.kitchenTicket.count({
        where: { status: { in: ['NEW', 'PREPARING'] } },
      }),
    ]);

    const low = allProducts.filter((p) => Number(p.on_hand_qty) <= Number(p.min_stock_level));
    const salesTotal = todayOrders.reduce((s, o) => s + Number(o.grand_total), 0);
    const orderCount = todayOrders.length;
    const byPayment: Record<string, number> = {};
    for (const o of todayOrders) {
      for (const p of o.payments) {
        if (p.status === 'CONFIRMED') {
          byPayment[p.method_name] = (byPayment[p.method_name] ?? 0) + Number(p.amount);
        }
      }
    }

    return {
      todaySales: salesTotal,
      todayOrders: orderCount,
      averageOrderValue: orderCount ? salesTotal / orderCount : 0,
      salesByPaymentMethod: byPayment,
      lowStock: low.map((p) => ({
        id: p.id,
        name: p.name,
        onHandQty: Number(p.on_hand_qty),
        minStock: Number(p.min_stock_level),
      })),
      wastageTodayCount: wastageToday,
      openKitchenTickets: openTickets,
    };
  }

  async salesReport(from: string, to: string) {
    const rows = await this.prisma.restaurantOrder.findMany({
      where: {
        created_at: { gte: new Date(from), lte: new Date(`${to}T23:59:59.999Z`) },
        status: { not: 'CANCELLED' },
      },
      include: { lines: true, payments: true, kitchen_tickets: true },
      orderBy: { created_at: 'asc' },
    });
    return {
      from,
      to,
      orderCount: rows.length,
      totalSales: rows.reduce((s, o) => s + Number(o.grand_total), 0),
      totalVat: rows.reduce((s, o) => s + Number(o.vat_total), 0),
      orders: rows.map((o) => this.mapOrder(o)),
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
}
