/**
 * Prisma POS / payment / kitchen repository. Schema-aligned field names.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { lineVat, type VatMode } from '../../domain/vat/calculations.ts';

function d(n: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

export class OrderRepository {
  private readonly prisma: PrismaClient;
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createOrder(input: {
    cashierId: string;
    orderType: string;
    platformReference?: string;
    deliveryRef?: string;
    tableNo?: string;
    idempotencyKey: string;
    lines: Array<{
      menuItemId: string;
      quantity: number;
      unitPrice?: number;
      notes?: string;
    }>;
    payments?: Array<{
      method: string;
      amount: number;
      reference?: string;
    }>;
    discountAmount?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope: 'pos_order', key: input.idempotencyKey } },
        include: {
          order: { include: { lines: true, payments: true, kitchen_tickets: true } },
        },
      });
      if (existing?.order) {
        return this.mapOrder(existing.order);
      }

      const orderType = await tx.orderType.findUnique({ where: { name: input.orderType } });
      if (!orderType?.is_active) throw new Error(`Unknown order type: ${input.orderType}`);
      const deliveryRef = (input.deliveryRef ?? input.platformReference ?? '').trim();
      if (orderType.requires_reference && !deliveryRef) {
        throw new Error('Delivery platform reference is required for this order type');
      }

      const vatSetting = await tx.vatSetting.findFirst({ orderBy: { effective_from: 'desc' } });
      const vatRatePercent = vatSetting ? Number(vatSetting.rate_percent) : 16;
      const vatMode: VatMode = vatSetting?.prices_include_vat ? 'INCLUSIVE' : 'EXCLUSIVE';

      if (!input.lines?.length) throw new Error('Order must contain at least one line');

      let subtotal = d(0);
      let vatTotal = d(0);
      const lineCreates: Prisma.RestaurantOrderLineCreateWithoutOrderInput[] = [];

      for (const line of input.lines) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: line.menuItemId } });
        if (!menuItem?.is_active || !menuItem.is_available) {
          throw new Error(`Menu item unavailable: ${line.menuItemId}`);
        }
        if (line.quantity <= 0) throw new Error('Line quantity must be positive');

        const unitPrice = line.unitPrice ?? Number(menuItem.price);
        const lineGross = unitPrice * line.quantity;
        const vat = lineVat(lineGross, vatRatePercent, vatMode);
        subtotal = subtotal.plus(vat.net);
        vatTotal = vatTotal.plus(vat.vat);

        lineCreates.push({
          menu_item_id: menuItem.id,
          name_snapshot: menuItem.name,
          quantity: d(line.quantity),
          unit_price: d(unitPrice),
          line_total: d(lineGross),
          vat_amount: d(vat.vat),
          vat_class: menuItem.vat_class ?? 'standard',
          notes: line.notes ?? null,
        });
      }

      const discount = d(input.discountAmount ?? 0);
      if (discount.lt(0)) throw new Error('Discount cannot be negative');
      const grand = subtotal.plus(vatTotal).minus(discount);
      if (grand.lt(0)) throw new Error('Order total cannot be negative after discount');

      const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seq = (await tx.restaurantOrder.count()) + 1;
      const orderNo = `ORD-${dayKey}-${String(seq).padStart(5, '0')}`;
      const ticketNo = `KT-${dayKey}-${String(seq).padStart(5, '0')}`;

      let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
      const paymentCreates: Prisma.PaymentRecordCreateWithoutOrderInput[] = [];
      let paidSum = d(0);

      for (const p of input.payments ?? []) {
        if (p.amount <= 0) throw new Error('Payment amount must be positive');
        paidSum = paidSum.plus(p.amount);
        paymentCreates.push({
          method_name: p.method,
          amount: d(p.amount),
          status: 'CONFIRMED',
          reference: p.reference ?? null,
          confirmed_at: new Date(),
        });
      }
      if (paidSum.gte(grand) && paidSum.gt(0)) paymentStatus = 'PAID';
      else if (paidSum.gt(0)) paymentStatus = 'PARTIALLY_PAID';
      if (paidSum.gt(grand.plus(0.01))) throw new Error('Payments exceed order total');

      const order = await tx.restaurantOrder.create({
        data: {
          order_no: orderNo,
          status: 'NEW',
          payment_status: paymentStatus,
          order_type: input.orderType,
          delivery_ref: deliveryRef || null,
          table_no: input.tableNo ?? null,
          subtotal,
          vat_total: vatTotal,
          grand_total: grand,
          vat_mode: vatMode,
          vat_rate: d(vatRatePercent / 100),
          cashier_id: input.cashierId,
          idempotency_key: input.idempotencyKey,
          lines: { create: lineCreates },
          payments: paymentCreates.length ? { create: paymentCreates } : undefined,
          kitchen_tickets: {
            create: { ticket_no: ticketNo, status: 'NEW' },
          },
        },
        include: { lines: true, payments: true, kitchen_tickets: true },
      });

      await tx.idempotencyRecord.create({
        data: {
          scope: 'pos_order',
          key: input.idempotencyKey,
          request_hash: input.idempotencyKey,
          response_status: 201,
          response_body: { orderId: order.id } as Prisma.InputJsonValue,
          order_id: order.id,
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: input.cashierId,
          action: 'ORDER_CREATED',
          entity_type: 'order',
          entity_id: order.id,
          new_values: {
            orderNo,
            total: Number(grand),
            lineCount: input.lines.length,
            paymentStatus,
          },
        },
      });

      return this.mapOrder(order);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateTicketStatus(
    ticketId: string,
    status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'COLLECTED' | 'CANCELLED',
    userId: string,
  ) {
    const allowed: Record<string, string[]> = {
      NEW: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['SERVED', 'COLLECTED', 'CANCELLED'],
      SERVED: [],
      COLLECTED: [],
      CANCELLED: [],
    };

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.kitchenTicket.findUnique({
        where: { id: ticketId },
        include: { order: true },
      });
      if (!ticket) throw new Error('Kitchen ticket not found');

      const current = ticket.status;
      if (!allowed[current]?.includes(status)) {
        throw new Error(`Invalid kitchen transition: ${current} → ${status}`);
      }

      const updated = await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status,
          ...(status === 'PREPARING' ? { preparing_at: new Date() } : {}),
          ...(status === 'READY' ? { ready_at: new Date() } : {}),
          ...(status === 'SERVED' || status === 'COLLECTED' ? { served_at: new Date() } : {}),
        },
      });

      await tx.kitchenTicketTransition.create({
        data: {
          ticket_id: ticketId,
          from_status: current,
          to_status: status,
          changed_by: userId,
        },
      });

      await tx.restaurantOrder.update({
        where: { id: ticket.order_id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          user_id: userId,
          action: 'KITCHEN_STATUS_CHANGE',
          entity_type: 'kitchen_ticket',
          entity_id: ticketId,
          old_values: { status: current },
          new_values: { status },
        },
      });

      return {
        id: updated.id,
        orderId: ticket.order_id,
        status: updated.status,
        ticketNo: updated.ticket_no,
      };
    });
  }

  async voidOrder(orderId: string, reason: string, userId: string) {
    if (!reason?.trim()) throw new Error('Void reason is required');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.restaurantOrder.findUnique({
        where: { id: orderId },
        include: { payments: true, kitchen_tickets: true },
      });
      if (!order) throw new Error('Order not found');
      if (order.status === 'CANCELLED') throw new Error('Order is already cancelled');

      const updated = await tx.restaurantOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          void_reason: reason.trim(),
          voided_at: new Date(),
        },
      });

      for (const t of order.kitchen_tickets) {
        await tx.kitchenTicket.update({
          where: { id: t.id },
          data: { status: 'CANCELLED' },
        });
        await tx.kitchenTicketTransition.create({
          data: {
            ticket_id: t.id,
            from_status: t.status,
            to_status: 'CANCELLED',
            changed_by: userId,
            reason: reason.trim(),
          },
        });
      }

      for (const p of order.payments) {
        if (p.status === 'CONFIRMED') {
          await tx.paymentRecord.update({
            where: { id: p.id },
            data: { status: 'REFUNDED' },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          user_id: userId,
          action: 'ORDER_VOIDED',
          entity_type: 'order',
          entity_id: orderId,
          reason: reason.trim(),
        },
      });

      return {
        id: updated.id,
        orderNo: updated.order_no,
        status: updated.status,
        voidReason: updated.void_reason,
      };
    });
  }

  private mapOrder(o: any) {
    const order = {
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      paymentStatus: o.payment_status,
      orderType: o.order_type,
      platformReference: o.delivery_ref,
      deliveryRef: o.delivery_ref,
      tableNo: o.table_no,
      subtotal: Number(o.subtotal),
      vatAmount: Number(o.vat_total),
      vatTotal: Number(o.vat_total),
      totalAmount: Number(o.grand_total),
      grandTotal: Number(o.grand_total),
      cashierId: o.cashier_id,
      createdAt: o.created_at?.toISOString?.() ?? o.created_at,
      lines: (o.lines ?? []).map((l: any) => ({
        id: l.id,
        menuItemId: l.menu_item_id,
        name: l.name_snapshot,
        nameSnapshot: l.name_snapshot,
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
    const ticketRow = o.kitchen_tickets?.[0];
    const ticket = ticketRow
      ? {
          id: ticketRow.id,
          orderId: o.id,
          ticketNo: ticketRow.ticket_no,
          status: ticketRow.status,
        }
      : undefined;
    // Frontend contract: { order, ticket }
    return { order, ticket };
  }
}

