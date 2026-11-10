/**
 * Prisma stock / purchase / wastage / makeline repository.
 * Field names match schema.prisma exactly. Calculations use domain helpers.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { unitPriceFromReceipt } from '../../domain/stock/calculations.ts';
import { convertToBase } from '../../domain/stock/units.ts';

function d(n: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

export class StockRepository {
  private readonly prisma: PrismaClient;
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async receiveStock(input: {
    supplierId: string;
    dateReceived: string;
    createdById: string;
    invoiceNo?: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
      totalPrice: number;
      expiryDate?: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier?.is_active) throw new Error('Supplier not found or inactive');

      const date = new Date(input.dateReceived);
      const dayKey = input.dateReceived.replace(/-/g, '');
      const count = await tx.purchase.count({
        where: { date_received: { gte: new Date(`${input.dateReceived}T00:00:00.000Z`) } },
      });
      const purchaseNo = `PUR-${dayKey}-${String(count + 1).padStart(4, '0')}`;

      let totalAmount = d(0);
      const createdItems: Array<{
        productId: string;
        quantityBase: number;
        totalPrice: number;
        unitPrice: number;
        expiryDate?: string;
      }> = [];

      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { base_unit: true },
        });
        if (!product?.is_active) throw new Error(`Product not found: ${item.productId}`);

        const quantityBase = convertToBase(item.quantity, item.unit, product.base_unit.code);
        if (quantityBase <= 0) throw new Error('Quantity must be greater than zero');
        if (item.totalPrice < 0) throw new Error('Total price cannot be negative');

        const unitPrice = unitPriceFromReceipt(item.totalPrice, quantityBase);
        const prevQty = Number(product.on_hand_qty);
        const prevCost = Number(product.avg_unit_cost);
        const newQty = prevQty + quantityBase;
        const poolValue = prevQty * prevCost + item.totalPrice;
        const newAvg = newQty > 0 ? poolValue / newQty : 0;

        await tx.product.update({
          where: { id: product.id },
          data: { on_hand_qty: d(newQty), avg_unit_cost: d(newAvg) },
        });

        const unitRow = await tx.unit.findUnique({ where: { code: product.base_unit.code } });
        if (!unitRow) throw new Error(`Unit not found: ${product.base_unit.code}`);

        createdItems.push({
          productId: product.id,
          quantityBase,
          totalPrice: item.totalPrice,
          unitPrice,
          expiryDate: item.expiryDate,
        });
        totalAmount = totalAmount.plus(item.totalPrice);
      }

      const purchase = await tx.purchase.create({
        data: {
          purchase_no: purchaseNo,
          supplier_id: input.supplierId,
          invoice_no: input.invoiceNo ?? null,
          date_received: date,
          total_amount: totalAmount,
          notes: input.notes ?? null,
          created_by_id: input.createdById,
          items: {
            create: await Promise.all(
              createdItems.map(async (ci, idx) => {
                const product = await tx.product.findUniqueOrThrow({
                  where: { id: ci.productId },
                  include: { base_unit: true },
                });
                return {
                  product_id: ci.productId,
                  quantity: d(input.items[idx].quantity),
                  unit_id: product.base_unit_id,
                  quantity_base: d(ci.quantityBase),
                  total_price: d(ci.totalPrice),
                  unit_price: d(ci.unitPrice),
                  expiry_date: ci.expiryDate ? new Date(ci.expiryDate) : null,
                };
              }),
            ),
          },
        },
        include: { items: true, supplier: true },
      });

      for (const ci of createdItems) {
        await tx.stockMovement.create({
          data: {
            movement_type: 'PURCHASE_RECEIPT',
            product_id: ci.productId,
            quantity_delta: d(ci.quantityBase),
            unit_cost: d(ci.unitPrice),
            value_delta: d(ci.totalPrice),
            source_type: 'purchase',
            source_id: purchase.id,
            idempotency_key: `purchase:${purchase.id}:${ci.productId}`,
            actor_id: input.createdById,
            notes: `Receipt ${purchaseNo}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          user_id: input.createdById,
          action: 'PURCHASE_CREATED',
          entity_type: 'purchase',
          entity_id: purchase.id,
          new_values: {
            purchaseNo,
            totalAmount: Number(totalAmount),
            itemCount: input.items.length,
          },
        },
      });

      return {
        id: purchase.id,
        purchaseNo: purchase.purchase_no,
        supplierId: purchase.supplier_id,
        dateReceived: input.dateReceived,
        items: createdItems,
        createdById: input.createdById,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async recordWastage(input: {
    productId?: string;
    makelineProductId?: string;
    quantityBase: number;
    reasonCode: string;
    wastedOn: string;
    userId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (!!input.productId === !!input.makelineProductId) {
        throw new Error('Exactly one of productId or makelineProductId is required');
      }
      if (!input.reasonCode?.trim()) throw new Error('Wastage reason is required');
      if (input.quantityBase <= 0) throw new Error('Quantity must be positive');

      if (input.productId) {
        const product = await tx.product.findUnique({ where: { id: input.productId } });
        if (!product) throw new Error('Product not found');
        if (Number(product.on_hand_qty) < input.quantityBase) {
          throw new Error('Wastage exceeds on-hand quantity');
        }
        const unitCost = Number(product.avg_unit_cost);
        await tx.product.update({
          where: { id: product.id },
          data: { on_hand_qty: { decrement: d(input.quantityBase) } },
        });
        const record = await tx.wastageRecord.create({
          data: {
            product_id: product.id,
            quantity_base: d(input.quantityBase),
            unit_cost_at_time: d(unitCost),
            reason_code: input.reasonCode.trim(),
            wasted_on: new Date(input.wastedOn),
            recorded_by_id: input.userId ?? null,
          },
        });
        await tx.stockMovement.create({
          data: {
            movement_type: 'WASTAGE',
            product_id: product.id,
            quantity_delta: d(-input.quantityBase),
            unit_cost: d(unitCost),
            value_delta: d(-(input.quantityBase * unitCost)),
            source_type: 'wastage',
            source_id: record.id,
            idempotency_key: `wastage:${record.id}`,
            actor_id: input.userId ?? null,
            notes: input.reasonCode,
          },
        });
        await tx.auditLog.create({
          data: {
            user_id: input.userId,
            action: 'WASTAGE_RECORDED',
            entity_type: 'wastage',
            entity_id: record.id,
            reason: input.reasonCode,
          },
        });
        return { id: record.id, ...input };
      }

      const mp = await tx.makelineProduct.findUnique({ where: { id: input.makelineProductId! } });
      if (!mp) throw new Error('Makeline product not found');
      if (Number(mp.on_hand_qty) < input.quantityBase) {
        throw new Error('Wastage exceeds on-hand quantity');
      }
      await tx.makelineProduct.update({
        where: { id: mp.id },
        data: { on_hand_qty: { decrement: d(input.quantityBase) } },
      });
      const record = await tx.wastageRecord.create({
        data: {
          makeline_product_id: mp.id,
          quantity_base: d(input.quantityBase),
          unit_cost_at_time: d(0),
          reason_code: input.reasonCode.trim(),
          wasted_on: new Date(input.wastedOn),
          recorded_by_id: input.userId ?? null,
        },
      });
      await tx.stockMovement.create({
        data: {
          movement_type: 'WASTAGE',
          makeline_product_id: mp.id,
          quantity_delta: d(-input.quantityBase),
          unit_cost: d(0),
          value_delta: d(0),
          source_type: 'wastage',
          source_id: record.id,
          idempotency_key: `wastage:${record.id}`,
          actor_id: input.userId ?? null,
          notes: input.reasonCode,
        },
      });
      return { id: record.id, ...input };
    });
  }

  async recordMakelineProduction(input: {
    makelineProductId: string;
    quantity: number;
    producedById: string;
    producedAt?: string;
    notes?: string;
    /** When true (or settings module on), deduct recipe inputs from purchased stock */
    applyRecipeDeduction?: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const mp = await tx.makelineProduct.findUnique({ where: { id: input.makelineProductId } });
      if (!mp?.is_active) throw new Error('Makeline product not found');
      if (input.quantity <= 0) throw new Error('Quantity must be positive');

      const settings = await tx.systemSetting.findMany({
        where: { key: { in: ['module_makeline_deductions'] } },
      });
      const sMap: Record<string, string> = {};
      for (const r of settings) sMap[r.key] = r.value;
      const deductOn =
        input.applyRecipeDeduction === true ||
        (input.applyRecipeDeduction !== false && sMap.module_makeline_deductions === '1');

      const deducted: Array<{ productId: string; name: string; qty: number }> = [];
      if (deductOn) {
        const recipes = await tx.recipeLine.findMany({
          where: { output_makeline_id: mp.id },
          include: { input_product: true },
        });
        for (const r of recipes) {
          if (!r.input_product_id || !r.input_product) continue;
          const need = Number(r.quantity) * input.quantity;
          if (need <= 0) continue;
          const onHand = Number(r.input_product.on_hand_qty);
          if (onHand < need) {
            throw new Error(
              `Insufficient ${r.input_product.name} for recipe: need ${need}, have ${onHand}`,
            );
          }
          await tx.product.update({
            where: { id: r.input_product_id },
            data: { on_hand_qty: { decrement: d(need) } },
          });
          const unitCost = Number(r.input_product.avg_unit_cost);
          await tx.stockMovement.create({
            data: {
              movement_type: 'RECIPE_DEDUCTION',
              product_id: r.input_product_id,
              quantity_delta: d(-need),
              unit_cost: d(unitCost),
              value_delta: d(-(need * unitCost)),
              source_type: 'makeline_production',
              source_id: mp.id,
              idempotency_key: `recipe_deduct:${mp.id}:${r.input_product_id}:${Date.now()}:${need}`,
              actor_id: input.producedById,
              notes: `Recipe for ${mp.name}`,
            },
          });
          deducted.push({ productId: r.input_product_id, name: r.input_product.name, qty: need });
        }
      }

      await tx.makelineProduct.update({
        where: { id: mp.id },
        data: { on_hand_qty: { increment: d(input.quantity) } },
      });
      const production = await tx.makelineProduction.create({
        data: {
          makeline_product_id: mp.id,
          quantity: d(input.quantity),
          produced_at: input.producedAt ? new Date(input.producedAt) : new Date(),
          produced_by_id: input.producedById,
          notes: input.notes ?? null,
        },
      });
      await tx.stockMovement.create({
        data: {
          movement_type: 'MAKELINE_PRODUCTION_IN',
          makeline_product_id: mp.id,
          quantity_delta: d(input.quantity),
          unit_cost: d(0),
          value_delta: d(0),
          source_type: 'makeline_production',
          source_id: production.id,
          idempotency_key: `makeline_prod:${production.id}`,
          actor_id: input.producedById,
        },
      });
      return {
        id: production.id,
        makelineProductId: mp.id,
        quantity: input.quantity,
        producedById: input.producedById,
        recipeDeducted: deducted,
      };
    });
  }

  async submitClosing(input: {
    periodStart: string;
    periodEnd: string;
    idempotencyKey: string;
    submittedById: string;
    items: Array<{
      itemType: 'PRODUCT' | 'MAKELINE';
      productId?: string;
      makelineProductId?: string;
      closingQty: number;
    }>;
    correctionOfId?: string;
    correctionReason?: string;
  }) {
    const {
      calculatePurchasedClosingLine,
      calculateMakelineClosingLine,
      assertClosingNotAboveAvailable,
    } = await import('../../domain/stock/calculations.ts');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope: 'closing', key: input.idempotencyKey } },
      });
      if (existing?.response_body) return existing.response_body as object;

      if (input.correctionOfId) {
        if (!input.correctionReason?.trim()) {
          throw new Error('Correction reason is required when superseding a closing');
        }
        await tx.stockClosingSession.update({
          where: { id: input.correctionOfId },
          data: { status: 'SUPERSEDED' },
        });
      }

      const periodStart = new Date(input.periodStart);
      const periodEnd = new Date(input.periodEnd);

      const lastClosing = await tx.stockClosingSession.findFirst({
        where: { status: 'SUBMITTED' },
        orderBy: { submitted_at: 'desc' },
        include: { items: true },
      });

      const itemCreates: Prisma.StockClosingItemCreateWithoutSessionInput[] = [];
      let totalValueUsed = d(0);
      let totalValueWasted = d(0);

      for (const line of input.items) {
        if (line.itemType === 'PRODUCT') {
          if (!line.productId) throw new Error('productId required');
          const product = await tx.product.findUnique({
            where: { id: line.productId },
            include: { base_unit: true },
          });
          if (!product) throw new Error(`Product not found: ${line.productId}`);

          const lastItem = lastClosing?.items.find(
            (i) => i.item_type === 'PRODUCT' && i.product_id === product.id,
          );
          const openingQty = lastItem ? Number(lastItem.closing_qty) : Number(product.on_hand_qty);
          const openingAvg = lastItem
            ? Number(lastItem.avg_unit_cost ?? product.avg_unit_cost)
            : Number(product.avg_unit_cost);

          const receipts = await tx.purchaseItem.findMany({
            where: {
              product_id: product.id,
              purchase: { date_received: { gte: periodStart, lte: periodEnd } },
            },
          });
          const receivedQty = receipts.reduce((s, r) => s + Number(r.quantity_base), 0);
          const receivedValue = receipts.reduce((s, r) => s + Number(r.total_price), 0);

          const wastageRows = await tx.wastageRecord.findMany({
            where: {
              product_id: product.id,
              wasted_on: { gte: periodStart, lte: periodEnd },
            },
          });
          const wastageQty = wastageRows.reduce((s, w) => s + Number(w.quantity_base), 0);

          const calc = calculatePurchasedClosingLine({
            openingQty,
            openingAvgCost: openingAvg,
            receivedQty,
            receivedValue,
            wastageQty,
            closingQty: line.closingQty,
            adjInQty: 0,
            adjOutQty: 0,
            adjInValue: 0,
          });
          assertClosingNotAboveAvailable(product.name, line.closingQty, calc.availableQty);

          await tx.product.update({
            where: { id: product.id },
            data: {
              on_hand_qty: d(line.closingQty),
              avg_unit_cost: d(calc.avgUnitCost),
            },
          });

          totalValueUsed = totalValueUsed.plus(calc.usedValue);
          totalValueWasted = totalValueWasted.plus(calc.wastageValue ?? 0);

          itemCreates.push({
            item_type: 'PRODUCT',
            product: { connect: { id: product.id } },
            name_snapshot: product.name,
            unit_snapshot: product.base_unit.code,
            opening_qty: d(openingQty),
            received_qty: d(receivedQty),
            wastage_qty: d(wastageQty),
            available_qty: d(calc.availableQty),
            closing_qty: d(line.closingQty),
            used_qty: d(calc.usedQty),
            avg_unit_cost: d(calc.avgUnitCost),
            used_value: d(calc.usedValue),
            wastage_value: d(calc.wastageValue ?? 0),
            closing_value: d(calc.closingValue),
          });
        } else {
          if (!line.makelineProductId) throw new Error('makelineProductId required');
          const mp = await tx.makelineProduct.findUnique({
            where: { id: line.makelineProductId },
            include: { unit: true },
          });
          if (!mp) throw new Error(`Makeline product not found: ${line.makelineProductId}`);

          const lastItem = lastClosing?.items.find(
            (i) => i.item_type === 'MAKELINE' && i.makeline_product_id === mp.id,
          );
          const openingQty = lastItem ? Number(lastItem.closing_qty) : Number(mp.on_hand_qty);

          const productions = await tx.makelineProduction.findMany({
            where: {
              makeline_product_id: mp.id,
              produced_at: { gte: periodStart, lte: periodEnd },
            },
          });
          const producedQty = productions.reduce((s, p) => s + Number(p.quantity), 0);

          const wastageRows = await tx.wastageRecord.findMany({
            where: {
              makeline_product_id: mp.id,
              wasted_on: { gte: periodStart, lte: periodEnd },
            },
          });
          const wastageQty = wastageRows.reduce((s, w) => s + Number(w.quantity_base), 0);

          const calc = calculateMakelineClosingLine({
            openingQty,
            producedQty,
            wastageQty,
            closingQty: line.closingQty,
            adjInQty: 0,
            adjOutQty: 0,
          });
          assertClosingNotAboveAvailable(mp.name, line.closingQty, calc.availableQty);

          await tx.makelineProduct.update({
            where: { id: mp.id },
            data: { on_hand_qty: d(line.closingQty) },
          });

          itemCreates.push({
            item_type: 'MAKELINE',
            makeline_product: { connect: { id: mp.id } },
            name_snapshot: mp.name,
            unit_snapshot: mp.unit.code,
            opening_qty: d(openingQty),
            received_qty: d(producedQty),
            wastage_qty: d(wastageQty),
            available_qty: d(calc.availableQty),
            closing_qty: d(line.closingQty),
            used_qty: d(calc.usedQty),
          });
        }
      }

      const dayKey = input.periodEnd.slice(0, 10).replace(/-/g, '');
      const seq = (await tx.stockClosingSession.count()) + 1;
      const closingNo = `CL-${dayKey}-${String(seq).padStart(4, '0')}`;

      const session = await tx.stockClosingSession.create({
        data: {
          closing_no: closingNo,
          status: 'SUBMITTED',
          period_start: periodStart,
          period_end: periodEnd,
          total_value_used: totalValueUsed,
          total_value_wasted: totalValueWasted,
          version: input.correctionOfId ? 2 : 1,
          supersedes_id: input.correctionOfId ?? null,
          correction_reason: input.correctionReason ?? null,
          idempotency_key: input.idempotencyKey,
          submitted_by_id: input.submittedById,
          submitted_at: new Date(),
          items: { create: itemCreates },
        },
        include: { items: true },
      });

      await tx.idempotencyRecord.create({
        data: {
          scope: 'closing',
          key: input.idempotencyKey,
          request_hash: input.idempotencyKey,
          response_status: 201,
          response_body: {
            id: session.id,
            closingNo: session.closing_no,
            status: session.status,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: input.submittedById,
          action: input.correctionOfId ? 'CLOSING_CORRECTED' : 'CLOSING_SUBMITTED',
          entity_type: 'stock_closing',
          entity_id: session.id,
          reason: input.correctionReason,
        },
      });

      return {
        id: session.id,
        closingNo: session.closing_no,
        status: session.status,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalValueUsed: Number(totalValueUsed),
        totalValueWasted: Number(totalValueWasted),
        items: session.items.map((i) => ({
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
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
