-- Migration: Add custom host details to visits table
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS host_name TEXT,
ADD COLUMN IF NOT EXISTS host_email TEXT;
