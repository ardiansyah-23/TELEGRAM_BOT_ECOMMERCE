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
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
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
