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
