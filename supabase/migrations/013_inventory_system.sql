-- Migration: 013_inventory_system
-- Description: Centralized inventory management, reservations, and audit ledger

-- =========================================================================
-- 1. Inventory Tables
-- =========================================================================

-- Inventories
CREATE TABLE IF NOT EXISTS inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure available_quantity (quantity - reserved_quantity) is not negative
    CONSTRAINT check_available_quantity CHECK ((quantity - reserved_quantity) >= 0)
);

-- Unique constraints for inventory (one per product or one per variant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_variant ON inventories (product_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_novariant ON inventories (product_id) WHERE variant_id IS NULL;


-- Inventory Movements (Ledger)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('sale', 'reservation', 'release', 'adjustment', 'return', 'cancellation', 'correction')),
    quantity INTEGER NOT NULL, -- Positive or negative
    reference_type VARCHAR(50), -- e.g., 'order', 'manual'
    reference_id UUID, -- order_id or admin_id
    reason TEXT,
    created_by BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL, -- who made the change
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inventory Reservations
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'confirmed', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    released_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(inventory_id, order_id) -- One reservation per item per order
);

-- =========================================================================
-- 2. Data Migration
-- =========================================================================

-- Migrate existing non-variant products
INSERT INTO inventories (product_id, variant_id, quantity, reserved_quantity, low_stock_threshold)
SELECT id, NULL, stock, 0, 5
FROM products
WHERE NOT EXISTS (SELECT 1 FROM inventories i WHERE i.product_id = products.id AND i.variant_id IS NULL);

-- Migrate existing product variants
INSERT INTO inventories (product_id, variant_id, quantity, reserved_quantity, low_stock_threshold)
SELECT product_id, id, stock, 0, 5
FROM product_variants
WHERE NOT EXISTS (SELECT 1 FROM inventories i WHERE i.variant_id = product_variants.id);


-- Create initial movements for migrated stock
INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reason, created_at)
SELECT id, 'correction', quantity, 'system', 'Initial data migration', created_at
FROM inventories;


-- =========================================================================
-- 3. Triggers & Indexes
-- =========================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventories_updated_at') THEN
        CREATE TRIGGER update_inventories_updated_at BEFORE UPDATE ON inventories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventories_product ON inventories(product_id);
CREATE INDEX IF NOT EXISTS idx_inventories_variant ON inventories(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order ON inventory_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status ON inventory_reservations(status);


-- =========================================================================
-- 4. Overhaul Checkout RPC for Reservation
-- =========================================================================

CREATE OR REPLACE FUNCTION checkout_cart(p_telegram_id BIGINT, p_order_number VARCHAR(50), p_order_note VARCHAR(500) DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_total NUMERIC(12,2) := 0;
    cart_item RECORD;
    v_inv_id UUID;
    v_available_stock INTEGER;
    v_is_active BOOLEAN;
    v_price NUMERIC(12,2);
    v_variant_name VARCHAR(255);
BEGIN
    -- 1. Create order
    INSERT INTO orders (order_number, telegram_id, status, subtotal, total, order_note)
    VALUES (p_order_number, p_telegram_id, 'pending', 0, 0, p_order_note)
    RETURNING id INTO v_order_id;

    -- 2. Process cart items
    FOR cart_item IN (
        SELECT c.id as cart_id, c.product_id, c.variant_id, c.quantity, p.name as product_name
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.telegram_id = p_telegram_id
    ) LOOP
        
        -- Get pricing info and determine variant name
        IF cart_item.variant_id IS NOT NULL THEN
            SELECT price INTO v_price FROM product_variants WHERE id = cart_item.variant_id;
            
            SELECT string_agg(o.name || ': ' || ov.value, ', ') INTO v_variant_name
            FROM product_variant_values pvv
            JOIN product_option_values ov ON pvv.option_value_id = ov.id
            JOIN product_options o ON ov.option_id = o.id
            WHERE pvv.variant_id = cart_item.variant_id;
        ELSE
            SELECT price INTO v_price FROM products WHERE id = cart_item.product_id;
            v_variant_name := NULL;
        END IF;

        -- Find inventory record
        IF cart_item.variant_id IS NOT NULL THEN
            SELECT id, (quantity - reserved_quantity), is_active 
            INTO v_inv_id, v_available_stock, v_is_active
            FROM inventories
            WHERE variant_id = cart_item.variant_id
            FOR UPDATE;
        ELSE
            SELECT id, (quantity - reserved_quantity), is_active 
            INTO v_inv_id, v_available_stock, v_is_active
            FROM inventories
            WHERE product_id = cart_item.product_id AND variant_id IS NULL
            FOR UPDATE;
        END IF;

        IF v_inv_id IS NULL THEN
            RAISE EXCEPTION 'Inventory not found for product %', cart_item.product_name;
        END IF;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'Inventory for product % is not active', cart_item.product_name;
        END IF;

        IF v_available_stock < cart_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %', cart_item.product_name;
        END IF;

        -- Reserve stock
        UPDATE inventories 
        SET reserved_quantity = reserved_quantity + cart_item.quantity 
        WHERE id = v_inv_id;

        -- Create reservation record (Expires in 2 hours for example)
        INSERT INTO inventory_reservations (inventory_id, order_id, quantity, status, expires_at)
        VALUES (v_inv_id, v_order_id, cart_item.quantity, 'active', now() + interval '2 hours');

        -- Log movement (Reservation)
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity, reference_type, reference_id, reason, created_by)
        VALUES (v_inv_id, 'reservation', -(cart_item.quantity), 'order', v_order_id, 'Stock reserved during checkout', p_telegram_id);

        -- Create order item
        INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, price, quantity, subtotal)
        VALUES (
            v_order_id, 
            cart_item.product_id, 
            cart_item.variant_id,
            cart_item.product_name, 
            v_variant_name,
            v_price, 
            cart_item.quantity, 
            v_price * cart_item.quantity
        );

        v_total := v_total + (v_price * cart_item.quantity);
    END LOOP;

    -- If cart was empty, raise error
    IF v_total = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    -- 3. Update total
    UPDATE orders SET subtotal = v_total, total = v_total WHERE id = v_order_id;

    -- 4. Clear cart
    DELETE FROM cart_items WHERE telegram_id = p_telegram_id;

    RETURN v_order_id;
END;
$$;


-- =========================================================================
-- 5. RLS Policies
-- =========================================================================

ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on inventories" ON inventories FOR SELECT USING (true);
CREATE POLICY "Deny anon access to movements" ON inventory_movements FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to reservations" ON inventory_reservations FOR ALL TO anon USING (false) WITH CHECK (false);

-- =========================================================================
-- 6. Helper RPCs for InventoryService
-- =========================================================================

CREATE OR REPLACE FUNCTION decrement_reserved_stock(p_inventory_id UUID, p_quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE inventories 
    SET reserved_quantity = reserved_quantity - p_quantity 
    WHERE id = p_inventory_id AND reserved_quantity >= p_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_reserved_stock(p_inventory_id UUID, p_quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE inventories 
    SET quantity = quantity - p_quantity,
        reserved_quantity = reserved_quantity - p_quantity 
    WHERE id = p_inventory_id 
    AND quantity >= p_quantity 
    AND reserved_quantity >= p_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION adjust_inventory_stock(p_inventory_id UUID, p_adjustment INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE inventories 
    SET quantity = quantity + p_adjustment 
    WHERE id = p_inventory_id;
END;
$$;
