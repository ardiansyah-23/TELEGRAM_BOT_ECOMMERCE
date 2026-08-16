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
