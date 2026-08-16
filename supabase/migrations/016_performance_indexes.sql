-- Migration: 016_performance_indexes
-- Description: Add missing indexes for critical tables to improve performance and avoid sequential scans on filtering

-- 1. Products
-- Index for active status filtering (very frequent in web app)
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;

-- 2. Orders
-- Index for status filtering (very frequent in admin dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
-- Index for date sorting (frequent in both user history and admin dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 3. Shipments
-- Index for shipment status
-- Note: Assuming shipments table exists (from Prompt 18 implementation plan, though user skipped its implementation). 
-- If it doesn't exist yet, we wrap it in a safe block or just ignore if table doesn't exist.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipments') THEN
        CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
        CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments(tracking_number);
    END IF;
END
$$;

-- 4. Inventory
-- Index for finding inventory items that are out of stock or low stock
CREATE INDEX IF NOT EXISTS idx_inventories_stock_levels ON inventories((quantity - reserved_quantity));

-- 5. Payments
-- Index for finding payments by status
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 6. Support Tickets
-- Index for support tickets by status
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
