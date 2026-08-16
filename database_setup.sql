-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users (telegram_id);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    action VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS activity_logs_telegram_id_idx ON activity_logs (telegram_id);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs (action);

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
-- Create bot_sessions table for grammY conversations
CREATE TABLE IF NOT EXISTS bot_sessions (
    id VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for bot_sessions updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bot_sessions_updated_at') THEN
        CREATE TRIGGER update_bot_sessions_updated_at
        BEFORE UPDATE ON bot_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_telegram_id BIGINT NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    target VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_target INTEGER NOT NULL DEFAULT 0,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);
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
-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL, -- e.g., 'midtrans'
    provider_transaction_id VARCHAR(255),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, failed, expired, cancelled
    payment_url TEXT,
    expired_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(order_id) -- One active payment per order. If failed/expired, we might update this or create new logic, but for simplicity, 1 payment record per order, which can be regenerated/updated.
);

-- Payment events table for webhook idempotency
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL UNIQUE, -- Prevents duplicate processing
    payload_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_id ON payment_events(provider_event_id);

-- Triggers for updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at') THEN
        CREATE TRIGGER update_payments_updated_at
        BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
-- 1. Updates to Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_level VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(20);
    is_unique BOOLEAN := FALSE;
BEGIN
    WHILE NOT is_unique LOOP
        new_code := 'REF-' || upper(substr(md5(random()::text), 1, 6));
        IF NOT EXISTS (SELECT 1 FROM users WHERE referral_code = new_code) THEN
            is_unique := TRUE;
        END IF;
    END LOOP;
    NEW.referral_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code on insert
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_referral_code') THEN
        CREATE TRIGGER set_referral_code
        BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION generate_referral_code();
    END IF;
END $$;

-- Also generate for existing users that don't have one
UPDATE users SET referral_code = 'REF-' || upper(substr(md5(random()::text), 1, 6)) WHERE referral_code IS NULL;

-- 2. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Referrals
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    referred_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, rewarded
    rewarded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(referred_telegram_id), -- A user can only be referred once
    CHECK (referrer_telegram_id != referred_telegram_id)
);

-- 4. Loyalty Points / Wallets
CREATE TABLE IF NOT EXISTS wallets (
    telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to auto-create wallet for new users
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (telegram_id, balance) VALUES (NEW.telegram_id, 0) ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_wallet') THEN
        CREATE TRIGGER trigger_create_wallet
        AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_wallet_for_new_user();
    END IF;
END $$;

-- Create wallets for existing users
INSERT INTO wallets (telegram_id, balance) SELECT telegram_id, 0 FROM users ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    reference_type VARCHAR(50), -- e.g., 'referral', 'purchase', 'manual'
    reference_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Coupons (Vouchers)
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC(12, 2) NOT NULL CHECK (value > 0),
    minimum_order NUMERIC(12, 2) NOT NULL DEFAULT 0,
    maximum_discount NUMERIC(12, 2), -- useful for percentage type (e.g. max 50k)
    usage_limit INTEGER, -- null means unlimited
    usage_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    order_id UUID NOT NULL, -- references orders but we define it after
    discount_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Update Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
-- In Orders, subtotal is before discount, total is after discount.

-- Add missing foreign key for coupon_usages
ALTER TABLE coupon_usages ADD CONSTRAINT fk_coupon_usages_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 7. Update Triggers for updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_plans_updated_at') THEN
        CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallets_updated_at') THEN
        CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_coupons_updated_at') THEN
        CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;


-- 8. RPC: Apply Subscription Payment
CREATE OR REPLACE FUNCTION apply_subscription_payment(p_telegram_id BIGINT, p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_user RECORD;
    v_new_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

    SELECT * INTO v_user FROM users WHERE telegram_id = p_telegram_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Calculate new expiration date
    IF v_user.membership_level = 'premium' AND v_user.membership_expires_at > now() THEN
        v_new_expires_at := v_user.membership_expires_at + (v_plan.duration_days || ' days')::interval;
    ELSE
        v_new_expires_at := now() + (v_plan.duration_days || ' days')::interval;
    END IF;

    UPDATE users 
    SET membership_level = 'premium', 
        membership_started_at = COALESCE(membership_started_at, now()),
        membership_expires_at = v_new_expires_at
    WHERE telegram_id = p_telegram_id;

    RETURN TRUE;
END;
$$;


-- 9. RPC: Point Transaction Logic
CREATE OR REPLACE FUNCTION process_point_transaction(
    p_telegram_id BIGINT, 
    p_type VARCHAR(20), 
    p_amount INTEGER, 
    p_ref_type VARCHAR(50), 
    p_ref_id VARCHAR(255), 
    p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Lock wallet row
    SELECT balance INTO v_balance FROM wallets WHERE telegram_id = p_telegram_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;

    IF p_type = 'debit' THEN
        IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient points'; END IF;
        UPDATE wallets SET balance = balance - p_amount WHERE telegram_id = p_telegram_id;
    ELSIF p_type = 'credit' THEN
        UPDATE wallets SET balance = balance + p_amount WHERE telegram_id = p_telegram_id;
    END IF;

    INSERT INTO point_transactions (telegram_id, type, amount, reference_type, reference_id, description)
    VALUES (p_telegram_id, p_type, p_amount, p_ref_type, p_ref_id, p_description);

    RETURN TRUE;
END;
$$;

-- 10. RPC: New Checkout Cart with Voucher (Replaces old checkout_cart)
-- We drop the old one and recreate it with coupon logic.
DROP FUNCTION IF EXISTS checkout_cart(BIGINT, VARCHAR);
CREATE OR REPLACE FUNCTION checkout_cart_with_voucher(
    p_telegram_id BIGINT, 
    p_order_number VARCHAR(50), 
    p_coupon_code VARCHAR(50) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_subtotal NUMERIC(12,2) := 0;
    v_total NUMERIC(12,2) := 0;
    v_discount NUMERIC(12,2) := 0;
    cart_item RECORD;
    v_current_stock INTEGER;
    v_product_active BOOLEAN;
    v_coupon RECORD;
    v_usage_count INTEGER;
BEGIN
    -- 1. Create order (pending)
    INSERT INTO orders (order_number, telegram_id, status, subtotal, discount, total, coupon_code)
    VALUES (p_order_number, p_telegram_id, 'pending', 0, 0, 0, p_coupon_code)
    RETURNING id INTO v_order_id;

    -- 2. Process cart items
    FOR cart_item IN (
        SELECT c.id as cart_id, c.product_id, c.quantity, p.price, p.name, p.stock, p.is_active
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.telegram_id = p_telegram_id
    ) LOOP
        -- Lock product
        SELECT stock, is_active INTO v_current_stock, v_product_active 
        FROM products WHERE id = cart_item.product_id FOR UPDATE;

        IF NOT v_product_active THEN RAISE EXCEPTION 'Product % is not active anymore', cart_item.name; END IF;
        IF v_current_stock < cart_item.quantity THEN RAISE EXCEPTION 'Insufficient stock for product %', cart_item.name; END IF;

        -- Update stock
        UPDATE products SET stock = stock - cart_item.quantity WHERE id = cart_item.product_id;

        -- Create order item
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal)
        VALUES (v_order_id, cart_item.product_id, cart_item.name, cart_item.price, cart_item.quantity, cart_item.price * cart_item.quantity);

        v_subtotal := v_subtotal + (cart_item.price * cart_item.quantity);
    END LOOP;

    -- Ensure cart wasn't empty
    IF v_subtotal = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    -- 3. Voucher Validation
    IF p_coupon_code IS NOT NULL THEN
        SELECT * INTO v_coupon FROM coupons WHERE code = p_coupon_code FOR UPDATE;
        
        IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found'; END IF;
        IF NOT v_coupon.is_active THEN RAISE EXCEPTION 'Coupon inactive'; END IF;
        IF v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now() THEN RAISE EXCEPTION 'Coupon not yet started'; END IF;
        IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN RAISE EXCEPTION 'Coupon expired'; END IF;
        IF v_subtotal < v_coupon.minimum_order THEN RAISE EXCEPTION 'Minimum order not met for this coupon'; END IF;
        IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN RAISE EXCEPTION 'Coupon usage limit reached'; END IF;

        -- Per-user limit
        SELECT count(*) INTO v_usage_count FROM coupon_usages WHERE coupon_id = v_coupon.id AND telegram_id = p_telegram_id;
        IF v_usage_count >= v_coupon.per_user_limit THEN RAISE EXCEPTION 'You have reached the usage limit for this coupon'; END IF;

        -- Calculate discount
        IF v_coupon.type = 'percentage' THEN
            v_discount := (v_subtotal * v_coupon.value) / 100;
            IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN
                v_discount := v_coupon.maximum_discount;
            END IF;
        ELSIF v_coupon.type = 'fixed' THEN
            v_discount := v_coupon.value;
        END IF;

        -- Prevent negative total
        IF v_discount > v_subtotal THEN
            v_discount := v_subtotal;
        END IF;

        -- Update usage count and insert usage record
        UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
        INSERT INTO coupon_usages (coupon_id, telegram_id, order_id, discount_amount)
        VALUES (v_coupon.id, p_telegram_id, v_order_id, v_discount);
    END IF;

    -- Calculate total
    v_total := v_subtotal - v_discount;

    -- 4. Update order total
    UPDATE orders 
    SET subtotal = v_subtotal, discount = v_discount, total = v_total 
    WHERE id = v_order_id;

    -- 5. Clear cart
    DELETE FROM cart_items WHERE telegram_id = p_telegram_id;

    RETURN v_order_id;
END;
$$;
-- Add timezone to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Create scheduled_jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- reminder, scheduled_message, membership_expiration, payment_expiration, order_notification, broadcast
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    locked_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for querying pending jobs efficiently
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status_run_at 
ON scheduled_jobs(status, run_at) 
WHERE status = 'pending';

-- Trigger to auto-update updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scheduled_jobs_updated_at') THEN
        CREATE TRIGGER update_scheduled_jobs_updated_at 
        BEFORE UPDATE ON scheduled_jobs 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RPC for claiming jobs atomically using SKIP LOCKED
CREATE OR REPLACE FUNCTION claim_scheduled_jobs(p_limit INTEGER)
RETURNS TABLE (
    id UUID,
    type VARCHAR,
    payload JSONB,
    attempts INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT j.id
        FROM scheduled_jobs j
        WHERE j.status = 'pending' 
          AND j.run_at <= now()
        ORDER BY j.run_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE scheduled_jobs
    SET status = 'processing',
        locked_at = now(),
        attempts = scheduled_jobs.attempts + 1,
        updated_at = now()
    FROM claimed
    WHERE scheduled_jobs.id = claimed.id
    RETURNING scheduled_jobs.id, scheduled_jobs.type, scheduled_jobs.payload, scheduled_jobs.attempts;
END;
$$;
-- Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    telegram_id BIGINT PRIMARY KEY,
    order_notifications BOOLEAN DEFAULT true,
    payment_notifications BOOLEAN DEFAULT true,
    membership_notifications BOOLEAN DEFAULT true,
    reward_notifications BOOLEAN DEFAULT true,
    campaign_notifications BOOLEAN DEFAULT true,
    system_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Segments
CREATE TABLE IF NOT EXISTS segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    template_id UUID REFERENCES message_templates(id),
    segment_id UUID REFERENCES segments(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, processing, completed, cancelled, failed
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_target INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Campaign Recipients
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, skipped
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(campaign_id, telegram_id) -- Idempotency constraint
);

-- Index for retrieving pending recipients
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_pending 
ON campaign_recipients(campaign_id, status) 
WHERE status = 'pending';

-- Triggers for updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_prefs_updated_at') THEN
        CREATE TRIGGER update_notification_prefs_updated_at 
        BEFORE UPDATE ON notification_preferences 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_message_templates_updated_at') THEN
        CREATE TRIGGER update_message_templates_updated_at 
        BEFORE UPDATE ON message_templates 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_segments_updated_at') THEN
        CREATE TRIGGER update_segments_updated_at 
        BEFORE UPDATE ON segments 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at') THEN
        CREATE TRIGGER update_campaigns_updated_at 
        BEFORE UPDATE ON campaigns 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RPC to atomic update stats
CREATE OR REPLACE FUNCTION update_campaign_stats(c_id UUID, added_sent INTEGER, added_failed INTEGER, added_skipped INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE campaigns
    SET total_sent = total_sent + added_sent,
        total_failed = total_failed + added_failed,
        total_skipped = total_skipped + added_skipped,
        updated_at = now()
    WHERE id = c_id;
END;
$$;
-- Migration: 008_admin_system
-- Description: Adds activity logs, system settings, and performance indexes for Admin Dashboard

-- Activity Logs for Audit Trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    actor_id BIGINT REFERENCES users(telegram_id), -- The admin who performed the action
    action VARCHAR(255) NOT NULL,
    target VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by BIGINT REFERENCES users(telegram_id)
);

-- Default Settings
INSERT INTO system_settings (key, value) VALUES 
('maintenance_mode', 'false'::jsonb),
('bot_name', '"Telegram Bot"'::jsonb),
('currency', '"IDR"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Performance Indexes for Dashboard Aggregation & Searching
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_run_at ON scheduled_jobs(run_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- RLS for activity_logs and system_settings
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage logs" ON activity_logs
    FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE telegram_id = (SELECT auth.uid()::bigint) AND role = 'admin'));

CREATE POLICY "Admins can manage settings" ON system_settings
    FOR ALL
    USING (EXISTS (SELECT 1 FROM users WHERE telegram_id = (SELECT auth.uid()::bigint) AND role = 'admin'));
-- Migration: 009_harden_rls
-- Description: Hardens RLS by denying anonymous access to critical tables.

-- We assume that our Vercel backend always uses the Service Role key 
-- to bypass RLS when interacting with Supabase, or we explicitly want to deny anon completely.

-- 1. Enable RLS on all critical tables if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing permissive public policies that might allow anon read/write
-- (Assuming we didn't create overly permissive policies, but just to be safe we drop them if we had them)
-- DROP POLICY IF EXISTS "Public can view active products" ON products;
-- etc.

-- 3. Create a strict deny-by-default for anonymous role
-- Since Vercel uses Service Role Key, it automatically bypasses RLS.
-- This ensures that if the Anon Key is leaked, the database cannot be queried directly from a browser.

CREATE POLICY "Deny all anon access to users" ON users FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access to categories" ON categories FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access to products" ON products FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access to orders" ON orders FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access to order_items" ON order_items FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access to payments" ON payments FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access to cart_items" ON cart_items FOR ALL TO anon USING (false) WITH CHECK (false);

-- If there is a need for users to authenticate directly to Supabase in the future via JWT, 
-- we would add policies for the 'authenticated' role. For now, the Vercel backend acts as the sole gatekeeper.
-- Migration: 010_observability
-- Description: Monitoring, Analytics & Observability Tables

-- 1. System Health
CREATE TABLE IF NOT EXISTS system_health (
    component VARCHAR(50) PRIMARY KEY,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'unknown',
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. System Alerts
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    component VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    fingerprint VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fingerprint_open ON system_alerts(fingerprint) WHERE status = 'open';

-- 3. System Logs (Error Tracking & Request Logging)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    request_id VARCHAR(100),
    action VARCHAR(100),
    actor VARCHAR(100),
    resource VARCHAR(100),
    duration_ms INTEGER,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bot Events (Bot Analytics)
CREATE TABLE IF NOT EXISTS bot_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id BIGINT,
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Hardening (Only accessible via API / Service Role)
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to health" ON system_health FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to alerts" ON system_alerts FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to logs" ON system_logs FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to bot_events" ON bot_events FOR ALL TO anon USING (false) WITH CHECK (false);
-- Migration: 011_ticketing_system
-- Description: Adds Customer Support, Ticketing & Helpdesk tables

-- 1. Ticket Categories
CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default categories
INSERT INTO ticket_categories (name, description) VALUES 
('Order', 'Masalah terkait pesanan'),
('Payment', 'Masalah terkait pembayaran'),
('Membership', 'Masalah terkait keanggotaan/subscription'),
('Product', 'Pertanyaan seputar produk'),
('Account', 'Masalah akses akun'),
('Technical', 'Kendala teknis bot/web'),
('Other', 'Lain-lain')
ON CONFLICT DO NOTHING;

-- Sequence for Ticket Number (TKT-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR AS $$
DECLARE
    next_val INTEGER;
BEGIN
    SELECT nextval('ticket_number_seq') INTO next_val;
    RETURN 'TKT-' || lpad(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE DEFAULT generate_ticket_number(),
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES ticket_categories(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'pending', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_admin_id BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ticket Messages
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'admin', 'system')),
    sender_id BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL, -- Null if system
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ticket_categories_updated_at') THEN
        CREATE TRIGGER update_ticket_categories_updated_at BEFORE UPDATE ON ticket_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tickets_updated_at') THEN
        CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RLS Configuration
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Deny Anon Access
CREATE POLICY "Deny anon access to ticket_categories" ON ticket_categories FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to tickets" ON tickets FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny anon access to ticket_messages" ON ticket_messages FOR ALL TO anon USING (false) WITH CHECK (false);

-- System uses Service Role, which bypasses RLS automatically.
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
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
