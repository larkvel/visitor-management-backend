ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (account_status IN ('trial', 'active', 'suspended', 'cancelled'));

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'company_admin', 'reception', 'executive', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_users_company_id ON app_users(company_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_by_user_id ON visits(created_by_user_id);

INSERT INTO app_users (id, company_id, full_name, email, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Platform Admin', 'platform.admin@example.com', 'platform_admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Company Admin', 'admin@acme.example.com', 'company_admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Reception Incharge', 'reception@acme.example.com', 'reception'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Executive User', 'executive@acme.example.com', 'executive')
ON CONFLICT (id) DO NOTHING;

UPDATE visits
SET created_by_user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
WHERE created_by_user_id IS NULL;
