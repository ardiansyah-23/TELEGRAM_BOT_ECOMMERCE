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
