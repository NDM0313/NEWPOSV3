import { describe, expect, it } from 'vitest';
import { computeSaleReturnSettlementSplit } from '@/app/lib/saleReturnSettlementSplit';

describe('computeSaleReturnSettlementSplit', () => {
  it('applies full return to due when return <= due', () => {
    expect(computeSaleReturnSettlementSplit({ returnTotal: 5000, dueBefore: 10000 })).toEqual({
      arPortion: 5000,
      refundPortion: 0,
      returnTotal: 5000,
    });
  });

  it('splits due first then refund remainder', () => {
    expect(computeSaleReturnSettlementSplit({ returnTotal: 5000, dueBefore: 3000 })).toEqual({
      arPortion: 3000,
      refundPortion: 2000,
      returnTotal: 5000,
    });
  });

  it('refunds all when due is zero', () => {
    expect(computeSaleReturnSettlementSplit({ returnTotal: 5000, dueBefore: 0 })).toEqual({
      arPortion: 0,
      refundPortion: 5000,
      returnTotal: 5000,
    });
  });
});
