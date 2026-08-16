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
