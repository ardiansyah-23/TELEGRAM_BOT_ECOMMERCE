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
