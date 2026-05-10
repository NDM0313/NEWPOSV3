-- Allow PRODUCTION_IN for studio finished-goods receipt (+qty at production cost before sale OUT).

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check CHECK (
  movement_type IS NULL OR movement_type IN (
    'PURCHASE',
    'SALE',
    'RETURN',
    'ADJUSTMENT',
    'TRANSFER',
    'SELL_RETURN',
    'PURCHASE_RETURN',
    'RENTAL_OUT',
    'RENTAL_RETURN',
    'PRODUCTION_IN',
    'PRODUCTION',
    'sale',
    'purchase',
    'sale_cancelled',
    'adjustment',
    'PURCHASE_CANCELLED',
    'SALE_CANCELLED',
    'sale_return',
    'rental_in',
    'rental_out'
  )
);

COMMENT ON COLUMN stock_movements.movement_type IS 'Includes PRODUCTION_IN for studio replica receipt at cost before SALE out.';
