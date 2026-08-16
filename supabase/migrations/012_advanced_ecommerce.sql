-- Migration: 012_advanced_ecommerce
-- Description: Advanced E-Commerce capabilities: Variants, Options, Wishlist, Reviews, Order Notes

-- =========================================================================
-- 1. Product Options & Variants
-- =========================================================================

-- Product Options (e.g., Size, Color)
CREATE TABLE IF NOT EXISTS product_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Size", "Color"
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Option Values (e.g., "39", "40", "Black")
CREATE TABLE IF NOT EXISTS product_option_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id UUID NOT NULL REFERENCES product_options(id) ON DELETE CASCADE,
    value VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Variants (Specific item combination)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Variant Values Mapping
CREATE TABLE IF NOT EXISTS product_variant_values (
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    option_value_id UUID NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
    PRIMARY KEY (variant_id, option_value_id)
);

-- =========================================================================
-- 2. Checkout & Orders Improvements
-- =========================================================================

-- Add variant support to cart
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Drop the old unique constraint and create a new one incorporating variant_id
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_telegram_id_product_id_key;
-- To ensure unique combinations of (telegram_id, product_id, variant_id), where variant_id can be null, 
-- we use a unique index treating nulls as distinct or coalesce nulls. PostgreSQL 15 allows UNIQUE NULLS NOT DISTINCT, 
-- but for wider compatibility we can create two partial indexes or use COALESCE.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_unique_variant ON cart_items (telegram_id, product_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_unique_novariant ON cart_items (telegram_id, product_id) WHERE variant_id IS NULL;


-- Add variant support and notes to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_note VARCHAR(500);

-- Add variant support to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name VARCHAR(255); -- e.g., "Size: 40, Color: Black"


-- =========================================================================
-- 3. Additional E-Commerce Features (Wishlist, Reviews, Recents)
-- =========================================================================

-- Wishlist
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(telegram_id, product_id)
);

-- Product Reviews
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    review TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Rule: One user can review a product per order only once
    UNIQUE(telegram_id, product_id, order_id)
);

-- Recently Viewed Products
CREATE TABLE IF NOT EXISTS recently_viewed_products (
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (telegram_id, product_id)
);


-- =========================================================================
-- 4. Triggers & Indexes
-- =========================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_options_updated_at') THEN
        CREATE TRIGGER update_product_options_updated_at BEFORE UPDATE ON product_options FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_option_values_updated_at') THEN
        CREATE TRIGGER update_product_option_values_updated_at BEFORE UPDATE ON product_option_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_variants_updated_at') THEN
        CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_reviews_updated_at') THEN
        CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(is_active);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(telegram_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_time ON recently_viewed_products(telegram_id, last_viewed_at DESC);


-- =========================================================================
-- 5. Updated Checkout RPC
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
    v_current_stock INTEGER;
    v_is_active BOOLEAN;
    v_price NUMERIC(12,2);
    v_item_name VARCHAR(255);
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
        -- If variant exists, lock variant. Else, lock product.
        IF cart_item.variant_id IS NOT NULL THEN
            SELECT stock, is_active, price INTO v_current_stock, v_is_active, v_price
            FROM product_variants
            WHERE id = cart_item.variant_id
            FOR UPDATE;

            IF NOT v_is_active THEN
                RAISE EXCEPTION 'Variant for product % is not active anymore', cart_item.product_name;
            END IF;

            IF v_current_stock < cart_item.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for variant of product %', cart_item.product_name;
            END IF;

            -- Deduct variant stock
            UPDATE product_variants SET stock = stock - cart_item.quantity WHERE id = cart_item.variant_id;

            -- Get variant name mapping (Option Values)
            SELECT string_agg(o.name || ': ' || ov.value, ', ') INTO v_variant_name
            FROM product_variant_values pvv
            JOIN product_option_values ov ON pvv.option_value_id = ov.id
            JOIN product_options o ON ov.option_id = o.id
            WHERE pvv.variant_id = cart_item.variant_id;

        ELSE
            SELECT stock, is_active, price INTO v_current_stock, v_is_active, v_price
            FROM products 
            WHERE id = cart_item.product_id 
            FOR UPDATE;

            IF NOT v_is_active THEN
                RAISE EXCEPTION 'Product % is not active anymore', cart_item.product_name;
            END IF;

            IF v_current_stock < cart_item.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for product %', cart_item.product_name;
            END IF;

            -- Deduct product stock
            UPDATE products SET stock = stock - cart_item.quantity WHERE id = cart_item.product_id;
            v_variant_name := NULL;
        END IF;

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
-- 6. RLS Policies
-- =========================================================================

ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to product_options" ON product_options FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to product_option_values" ON product_option_values FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to product_variants" ON product_variants FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to product_variant_values" ON product_variant_values FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to wishlists" ON wishlists FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to product_reviews" ON product_reviews FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to recently_viewed_products" ON recently_viewed_products FOR ALL TO anon USING (false) WITH CHECK (false);
