import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  unitPriceFromReceipt,
  calculatePurchasedClosingLine,
  calculateMakelineClosingLine,
  assertClosingNotAboveAvailable,
} from './calculations.ts';

describe('Blueprint §17.1 calculation tests', () => {
  it('C1: unit price Cooking Oil 20 L / 6000 = 300.00', () => {
    assert.equal(unitPriceFromReceipt(6000, 20), 300);
  });

  it('C2: Chicken open 10 receive 5 count 4 → used 11 value 5500', () => {
    const r = calculatePurchasedClosingLine({
      openingQty: 10,
      openingAvgCost: 500,
      receivedQty: 5,
      receivedValue: 2500,
      closingQty: 4,
    });
    assert.equal(r.availableQty, 15);
    assert.equal(r.usedQty, 11);
    assert.equal(r.avgUnitCost, 500);
    assert.equal(r.usedValue, 5500);
  });

  it('C3: Oil two prices → avg 296.25 used 3258.75 closing 6221.25', () => {
    const r = calculatePurchasedClosingLine({
      openingQty: 12,
      openingAvgCost: 290,
      receivedQty: 20,
      receivedValue: 6000,
      closingQty: 21,
    });
    assert.equal(r.poolQty, 32);
    assert.equal(r.avgUnitCost, 296.25);
    assert.equal(r.usedQty, 11);
    assert.equal(r.usedValue, 3258.75);
    assert.equal(r.closingValue, 6221.25);
  });

  it('C4: Tomatoes with waste → used 1864.35 waste 116.52', () => {
    const r = calculatePurchasedClosingLine({
      openingQty: 8,
      openingAvgCost: 110,
      receivedQty: 15,
      receivedValue: 1800,
      wastageQty: 1,
      closingQty: 6,
    });
    assert.equal(r.availableQty, 22);
    assert.equal(r.usedQty, 16);
    assert.equal(r.avgUnitCost, 116.5217);
    assert.equal(r.usedValue, 1864.35);
    assert.equal(r.wastageValue, 116.52);
  });

  it('B1: closing > available throws', () => {
    assert.throws(
      () => assertClosingNotAboveAvailable('Chicken', 20, 15),
      /Closing cannot be more than available/,
    );
  });

  it('B12: makeline has quantities only', () => {
    const r = calculateMakelineClosingLine({
      openingQty: 5,
      producedQty: 10,
      wastageQty: 1,
      closingQty: 6,
    });
    assert.equal(r.availableQty, 14);
    assert.equal(r.usedQty, 8);
  });
});
