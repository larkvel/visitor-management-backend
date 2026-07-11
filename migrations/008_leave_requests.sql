-- Migration 008: Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  leave_type VARCHAR(20) NOT NULL DEFAULT 'casual' CHECK (leave_type IN ('casual', 'sick', 'unpaid')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count NUMERIC(4,2) NOT NULL DEFAULT 1,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_company_status ON leave_requests(company_id, status);
