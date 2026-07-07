-- Add authentication columns to app_users
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Unique index on username (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username
  ON app_users(username) WHERE username IS NOT NULL;

-- Update account_status check constraint to include 'pending'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'companies'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%account_status%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE companies DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE companies
  ADD CONSTRAINT companies_account_status_check
  CHECK (account_status IN ('pending', 'trial', 'active', 'suspended', 'cancelled'));

ALTER TABLE companies ALTER COLUMN account_status SET DEFAULT 'pending';
