-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(telegram_id, product_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, processing, completed, cancelled
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_cart_telegram ON cart_items(telegram_id);
CREATE INDEX IF NOT EXISTS idx_orders_telegram ON orders(telegram_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Triggers for updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at') THEN
        CREATE TRIGGER update_categories_updated_at
        BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_updated_at') THEN
        CREATE TRIGGER update_products_updated_at
        BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cart_items_updated_at') THEN
        CREATE TRIGGER update_cart_items_updated_at
        BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
        CREATE TRIGGER update_orders_updated_at
        BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RPC for Atomic Checkout
CREATE OR REPLACE FUNCTION checkout_cart(p_telegram_id BIGINT, p_order_number VARCHAR(50))
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_total NUMERIC(12,2) := 0;
    cart_item RECORD;
    v_current_stock INTEGER;
    v_product_active BOOLEAN;
BEGIN
    -- 1. Create order first (pending)
    INSERT INTO orders (order_number, telegram_id, status, subtotal, total)
    VALUES (p_order_number, p_telegram_id, 'pending', 0, 0)
    RETURNING id INTO v_order_id;

    -- 2. Process cart items
    FOR cart_item IN (
        SELECT c.id as cart_id, c.product_id, c.quantity, p.price, p.name, p.stock, p.is_active
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.telegram_id = p_telegram_id
    ) LOOP
        -- Lock the product row for update to prevent concurrent stock changes
        SELECT stock, is_active INTO v_current_stock, v_product_active 
        FROM products 
        WHERE id = cart_item.product_id 
        FOR UPDATE;

        IF NOT v_product_active THEN
            RAISE EXCEPTION 'Product % is not active anymore', cart_item.name;
        END IF;

        IF v_current_stock < cart_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %', cart_item.name;
        END IF;

        -- Update stock
        UPDATE products 
        SET stock = stock - cart_item.quantity 
        WHERE id = cart_item.product_id;

        -- Create order item
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal)
        VALUES (
            v_order_id, 
            cart_item.product_id, 
            cart_item.name, 
            cart_item.price, 
            cart_item.quantity, 
            cart_item.price * cart_item.quantity
        );

        -- Add to total
        v_total := v_total + (cart_item.price * cart_item.quantity);
    END LOOP;

    -- 3. Update order total
    UPDATE orders 
    SET subtotal = v_total, total = v_total 
    WHERE id = v_order_id;

    -- 4. Clear cart
    DELETE FROM cart_items WHERE telegram_id = p_telegram_id;

    RETURN v_order_id;
END;
$$;
