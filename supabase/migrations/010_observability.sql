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
