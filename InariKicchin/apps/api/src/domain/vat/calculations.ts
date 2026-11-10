/**
 * Blueprint §8.5 VAT calculations (configurable rate — never hard-code in business logic callers).
 */
import { roundMoney } from '../stock/calculations.ts';

export type VatMode = 'INCLUSIVE' | 'EXCLUSIVE';

/** VAT-inclusive: VAT = line × rate / (100 + rate); Net = line − VAT */
export function vatFromInclusive(lineTotal: number, ratePercent: number): {
  vat: number;
  net: number;
  total: number;
} {
  if (ratePercent <= 0) {
    return { vat: 0, net: roundMoney(lineTotal), total: roundMoney(lineTotal) };
  }
  const vat = roundMoney((lineTotal * ratePercent) / (100 + ratePercent));
  const net = roundMoney(lineTotal - vat);
  return { vat, net, total: roundMoney(lineTotal) };
}

/** VAT-exclusive: VAT = net × rate / 100; Total = net + VAT */
export function vatFromExclusive(lineNet: number, ratePercent: number): {
  vat: number;
  net: number;
  total: number;
} {
  if (ratePercent <= 0) {
    return { vat: 0, net: roundMoney(lineNet), total: roundMoney(lineNet) };
  }
  const vat = roundMoney((lineNet * ratePercent) / 100);
  const net = roundMoney(lineNet);
  return { vat, net, total: roundMoney(net + vat) };
}

export function lineVat(
  amount: number,
  ratePercent: number,
  mode: VatMode,
): { vat: number; net: number; total: number } {
  return mode === 'INCLUSIVE'
    ? vatFromInclusive(amount, ratePercent)
    : vatFromExclusive(amount, ratePercent);
}
