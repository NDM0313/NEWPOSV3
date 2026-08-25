import { describe, expect, it } from 'vitest';
import {
  resolveStockMovementDisplayAmount,
  roundStockMoney,
  stockMovementAmountFromFields,
  STOCK_MONEY_EPS,
} from './stockMovementValuation';

describe('stockMovementValuation', () => {
  it('uses total_cost when set', () => {
    expect(stockMovementAmountFromFields({ total_cost: 1500, quantity: 3, unit_cost: 0 })).toBe(1500);
  });

  it('falls back to abs(qty) * unit_cost', () => {
    expect(stockMovementAmountFromFields({ quantity: -4, unit_cost: 250 })).toBe(1000);
  });

  it('returns zero when movement has no cost columns', () => {
    expect(stockMovementAmountFromFields({ quantity: 5, unit_cost: 0, total_cost: 0 })).toBe(0);
  });

  it('resolveStockMovementDisplayAmount uses product cost when movement cost is zero', () => {
    const amt = resolveStockMovementDisplayAmount({
      quantity: 2,
      unit_cost: 0,
      total_cost: 0,
      product_cost_price: 500,
    });
    expect(amt).toBe(1000);
  });

  it('resolveStockMovementDisplayAmount prefers variation cost over product', () => {
    const amt = resolveStockMovementDisplayAmount({
      quantity: 3,
      unit_cost: 0,
      total_cost: 0,
      product_cost_price: 100,
      variation_cost_price: 200,
    });
    expect(amt).toBe(600);
  });

  it('roundStockMoney rounds to 2 decimals', () => {
    expect(roundStockMoney(10.556)).toBe(10.56);
  });

  it('STOCK_MONEY_EPS is a small positive threshold', () => {
    expect(STOCK_MONEY_EPS).toBeGreaterThan(0);
    expect(STOCK_MONEY_EPS).toBeLessThan(1);
  });
});
