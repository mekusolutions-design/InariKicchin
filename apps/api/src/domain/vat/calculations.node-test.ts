import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vatFromInclusive, vatFromExclusive } from './calculations.ts';

describe('Blueprint §17.1 VAT tests', () => {
  it('C8: inclusive 4750 at 16% → VAT 655.17 net 4094.83', () => {
    const r = vatFromInclusive(4750, 16);
    assert.equal(r.vat, 655.17);
    assert.equal(r.net, 4094.83);
    assert.equal(r.total, 4750);
  });

  it('C9: exclusive net 1000 at 16% → VAT 160 total 1160', () => {
    const r = vatFromExclusive(1000, 16);
    assert.equal(r.vat, 160);
    assert.equal(r.total, 1160);
  });
});
