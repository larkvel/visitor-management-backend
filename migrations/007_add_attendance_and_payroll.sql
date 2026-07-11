-- Migration: Add Attendance & Payroll Modules
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS attendance_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payroll_enabled BOOLEAN DEFAULT false;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS biometric_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS salary_type VARCHAR(15) DEFAULT 'monthly' CHECK (salary_type IN ('daily', 'monthly')),
ADD COLUMN IF NOT EXISTS salary_rate NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS paid_leaves_limit NUMERIC(4, 2) DEFAULT 1.5;

CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  punched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  punch_type VARCHAR(10) NOT NULL CHECK (punch_type IN ('IN', 'OUT')),
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  company_display_name TEXT,
  company_address TEXT,
  footer_text TEXT,
  digital_signature_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL,
  present_days NUMERIC(4, 2) NOT NULL,
  absent_days NUMERIC(4, 2) NOT NULL,
  paid_leaves_used NUMERIC(4, 2) NOT NULL,
  unpaid_leaves_used NUMERIC(4, 2) NOT NULL,
  gross_salary NUMERIC(10, 2) NOT NULL,
  deductions NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  net_salary NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_date ON attendance_logs(user_id, punched_at);
CREATE INDEX IF NOT EXISTS idx_monthly_payroll_company_date ON monthly_payroll(company_id, year, month);
