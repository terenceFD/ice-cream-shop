-- Run this in Supabase (SQL Editor) to fix production IMMEDIATELY,
-- without waiting for a redeploy. Safe to run more than once.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_admin_seen SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_notified_at TEXT;
