import { describe, expect, it } from 'vitest';
import {
  formatAdjustmentNotes,
  isEditableManualStockAdjustment,
  parseAdjustmentNotes,
  projectedStockBalanceAfterEdit,
} from './stockMovementEditPolicy';

describe('stockMovementEditPolicy', () => {
  it('allows manual adjustment rows', () => {
    expect(
      isEditableManualStockAdjustment({
        movement_type: 'adjustment',
        reference_type: 'adjustment',
        reference_id: null,
      })
    ).toBe(true);
  });

  it('blocks sale-linked movements', () => {
    expect(
      isEditableManualStockAdjustment({
        movement_type: 'adjustment',
        reference_type: 'sale',
        reference_id: 'uuid',
      })
    ).toBe(false);
  });

  it('blocks opening balance', () => {
    expect(
      isEditableManualStockAdjustment({
        movement_type: 'adjustment',
        reference_type: 'opening_balance',
      })
    ).toBe(false);
  });

  it('blocks non-adjustment types', () => {
    expect(
      isEditableManualStockAdjustment({
        movement_type: 'sale',
        reference_type: 'sale',
        reference_id: 'uuid',
      })
    ).toBe(false);
  });

  it('projected balance after edit', () => {
    expect(projectedStockBalanceAfterEdit(10, 5, -3)).toBe(2);
    expect(projectedStockBalanceAfterEdit(10, -2, -5)).toBe(7);
  });

  it('parses and formats adjustment notes', () => {
    expect(parseAdjustmentNotes('correction: wrong count')).toEqual({
      reason: 'correction',
      detail: 'wrong count',
    });
    expect(formatAdjustmentNotes('audit', 'cycle count')).toBe('audit: cycle count');
  });
});
