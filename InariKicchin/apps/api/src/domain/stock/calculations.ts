/**
 * Inari Kicchin — Blueprint §4 inventory calculation formulas
 * Source of truth: Restaurant Management System Blueprint v1.0
 *
 * Money: 2 decimal places, half-up.
 * Unit cost: 4 decimal places internal.
 * Report totals = sum of rounded line values.
 */

export type Money = number; // always rounded to 2 dp when persisted/displayed
export type Qty = number; // base-unit quantity
export type UnitCost = number; // 4 dp internal

/** Round half-up to 2 decimal places (money). */
export function roundMoney(value: number): Money {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round half-up to 4 decimal places (unit cost). */
export function roundUnitCost(value: number): UnitCost {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * Unit price on receipt (Blueprint §4.2)
 * Unit price = Total purchase price / Quantity received
 */
export function unitPriceFromReceipt(
  totalPurchasePrice: Money,
  quantityReceived: Qty,
): UnitCost {
  if (quantityReceived <= 0) {
    throw new Error('Quantity received must be greater than 0');
  }
  if (totalPurchasePrice < 0) {
    throw new Error('Total purchase price cannot be negative');
  }
  return roundUnitCost(totalPurchasePrice / quantityReceived);
}

export interface WeightedAverageInput {
  openingQty: Qty;
  openingAvgCost: UnitCost;
  /** Sum of receipt quantities in period (base unit), net of returns */
  receivedQty: Qty;
  /** Sum of receipt total prices in period */
  receivedValue: Money;
  /** Adjustments IN quantity */
  adjInQty?: Qty;
  /** Value of adjustments IN (qty × cost at time, or entered cost) */
  adjInValue?: Money;
}

export interface WeightedAverageResult {
  poolQty: Qty;
  poolValue: Money;
  avgUnitCost: UnitCost;
}

/**
 * Weighted average unit cost at closing (Blueprint §4.3)
 * Pool qty = Opening + Received + Adj IN
 * Pool value = Opening value + Received value + Adj IN value
 * Avg = Pool value / Pool qty
 */
export function weightedAverageCost(
  input: WeightedAverageInput,
): WeightedAverageResult {
  const adjInQty = input.adjInQty ?? 0;
  const adjInValue = input.adjInValue ?? 0;
  const openingValue = input.openingQty * input.openingAvgCost;
  const poolQty = input.openingQty + input.receivedQty + adjInQty;
  const poolValue = openingValue + input.receivedValue + adjInValue;
  if (poolQty <= 0) {
    return { poolQty: 0, poolValue: roundMoney(poolValue), avgUnitCost: 0 };
  }
  return {
    poolQty,
    poolValue: roundMoney(poolValue),
    avgUnitCost: roundUnitCost(poolValue / poolQty),
  };
}

export interface AvailableStockInput {
  openingQty: Qty;
  receivedQty: Qty;
  adjInQty?: Qty;
  adjOutQty?: Qty;
  wastageQty?: Qty;
}

/**
 * Total available (Blueprint §4.1)
 * Opening + Received + Adj IN − Adj OUT − Wastage
 */
export function totalAvailable(input: AvailableStockInput): Qty {
  const adjIn = input.adjInQty ?? 0;
  const adjOut = input.adjOutQty ?? 0;
  const waste = input.wastageQty ?? 0;
  return (
    input.openingQty + input.receivedQty + adjIn - adjOut - waste
  );
}

/**
 * Stock used = Total available − Closing (physical count)
 */
export function stockUsed(available: Qty, closingQty: Qty): Qty {
  return available - closingQty;
}

/**
 * Value of stock used = Stock used × Weighted average unit cost
 */
export function valueOfStockUsed(usedQty: Qty, avgUnitCost: UnitCost): Money {
  return roundMoney(usedQty * avgUnitCost);
}

export interface ClosingLineInput {
  openingQty: Qty;
  openingAvgCost: UnitCost;
  receivedQty: Qty;
  receivedValue: Money;
  adjInQty?: Qty;
  adjInValue?: Money;
  adjOutQty?: Qty;
  wastageQty?: Qty;
  closingQty: Qty;
}

export interface ClosingLineResult {
  availableQty: Qty;
  usedQty: Qty;
  avgUnitCost: UnitCost;
  usedValue: Money;
  wastageValue: Money;
  closingValue: Money;
  poolQty: Qty;
  poolValue: Money;
}

/**
 * Full purchased-inventory closing line calculation (Blueprint §4 + §5).
 * Closing must be >= 0 and <= available (caller validates).
 */
export function calculatePurchasedClosingLine(
  input: ClosingLineInput,
): ClosingLineResult {
  const wac = weightedAverageCost({
    openingQty: input.openingQty,
    openingAvgCost: input.openingAvgCost,
    receivedQty: input.receivedQty,
    receivedValue: input.receivedValue,
    adjInQty: input.adjInQty,
    adjInValue: input.adjInValue,
  });
  const available = totalAvailable({
    openingQty: input.openingQty,
    receivedQty: input.receivedQty,
    adjInQty: input.adjInQty,
    adjOutQty: input.adjOutQty,
    wastageQty: input.wastageQty,
  });
  const used = stockUsed(available, input.closingQty);
  const wasteQty = input.wastageQty ?? 0;
  return {
    availableQty: available,
    usedQty: used,
    avgUnitCost: wac.avgUnitCost,
    usedValue: valueOfStockUsed(used, wac.avgUnitCost),
    wastageValue: valueOfStockUsed(wasteQty, wac.avgUnitCost),
    closingValue: valueOfStockUsed(input.closingQty, wac.avgUnitCost),
    poolQty: wac.poolQty,
    poolValue: wac.poolValue,
  };
}

export interface MakelineClosingInput {
  openingQty: Qty;
  producedQty: Qty;
  adjInQty?: Qty;
  adjOutQty?: Qty;
  wastageQty?: Qty;
  closingQty: Qty;
}

/**
 * Makeline closing (Blueprint §5.2 / §6) — quantity only, no cost in v1.
 */
export function calculateMakelineClosingLine(input: MakelineClosingInput): {
  availableQty: Qty;
  usedQty: Qty;
} {
  const available = totalAvailable({
    openingQty: input.openingQty,
    receivedQty: input.producedQty,
    adjInQty: input.adjInQty,
    adjOutQty: input.adjOutQty,
    wastageQty: input.wastageQty,
  });
  return {
    availableQty: available,
    usedQty: stockUsed(available, input.closingQty),
  };
}

/** Validation: closing cannot exceed available (Blueprint §4.5). */
export function assertClosingNotAboveAvailable(
  productName: string,
  closingQty: Qty,
  availableQty: Qty,
): void {
  if (closingQty < 0) {
    throw new Error(`${productName}: closing count cannot be negative`);
  }
  if (closingQty > availableQty) {
    throw new Error(
      `Closing cannot be more than available (${availableQty}). Record the missing delivery or an adjustment first. (${productName})`,
    );
  }
}
