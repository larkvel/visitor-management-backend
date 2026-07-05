CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, email)
);

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  host_id UUID REFERENCES hosts(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  visitor_email TEXT,
  visitor_phone TEXT,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'expected' CHECK (status IN ('expected', 'checked_in', 'checked_out', 'cancelled')),
  expected_at TIMESTAMPTZ NOT NULL,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_company_id ON locations(company_id);
CREATE INDEX IF NOT EXISTS idx_hosts_company_id ON hosts(company_id);
CREATE INDEX IF NOT EXISTS idx_visits_company_status ON visits(company_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_expected_at ON visits(expected_at);
