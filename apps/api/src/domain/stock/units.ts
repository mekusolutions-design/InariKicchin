/**
 * Blueprint §4.4 unit conversions — dimension-safe factors to base unit.
 */
export type Dimension = 'WEIGHT' | 'VOLUME' | 'COUNT';

const FACTORS: Record<string, { dimension: Dimension; toBase: number }> = {
  kg: { dimension: 'WEIGHT', toBase: 1 },
  g: { dimension: 'WEIGHT', toBase: 0.001 },
  l: { dimension: 'VOLUME', toBase: 1 },
  litre: { dimension: 'VOLUME', toBase: 1 },
  liter: { dimension: 'VOLUME', toBase: 1 },
  ml: { dimension: 'VOLUME', toBase: 0.001 },
  pcs: { dimension: 'COUNT', toBase: 1 },
  pc: { dimension: 'COUNT', toBase: 1 },
  dozen: { dimension: 'COUNT', toBase: 12 },
  bottle: { dimension: 'COUNT', toBase: 1 },
  packet: { dimension: 'COUNT', toBase: 1 },
};

export function normalizeUnitCode(code: string): string {
  return code.trim().toLowerCase();
}

export function convertToBase(
  quantity: number,
  fromUnit: string,
  productBaseUnit: string,
): number {
  const from = FACTORS[normalizeUnitCode(fromUnit)];
  const base = FACTORS[normalizeUnitCode(productBaseUnit)];
  if (!from || !base) {
    throw new Error(`Unknown unit: ${fromUnit} or ${productBaseUnit}`);
  }
  if (from.dimension !== base.dimension) {
    throw new Error(
      `${fromUnit} cannot be converted to ${productBaseUnit} for this product.`,
    );
  }
  // Convert from → SI-ish base of dimension, then to product base
  const inDimensionBase = quantity * from.toBase;
  return inDimensionBase / base.toBase;
}
