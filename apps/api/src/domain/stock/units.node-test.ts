import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertToBase } from './units.ts';

describe('Blueprint §4.4 / C6–C7 unit conversion', () => {
  it('C6: 500 g for kg product → 0.5 kg', () => {
    assert.equal(convertToBase(500, 'g', 'kg'), 0.5);
  });

  it('C7: kg to litre blocked', () => {
    assert.throws(
      () => convertToBase(1, 'kg', 'l'),
      /cannot be converted/,
    );
  });

  it('2 dozen → 24 pcs', () => {
    assert.equal(convertToBase(2, 'dozen', 'pcs'), 24);
  });
});
