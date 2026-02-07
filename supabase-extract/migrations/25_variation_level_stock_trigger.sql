-- ============================================================================
-- Variation-level stock tracking (RULE 1)
-- When movement has variation_id, do NOT update products.current_stock.
-- Parent product row stock = SUM(stock_movements) per variation in app; 
-- product.current_stock is only for products without variations.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update product-level current_stock when movement is at product level (no variation)
    -- When variation_id IS NOT NULL, stock is at variation level; parent does not hold stock
    IF NEW.variation_id IS NULL THEN
        UPDATE products
        SET 
            current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
