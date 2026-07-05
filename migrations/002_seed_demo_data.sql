INSERT INTO companies (id, name, industry)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corporation', 'Manufacturing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (id, company_id, name, address)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Head Office',
  '100 Business Park'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO hosts (id, company_id, full_name, email, department)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Priya Sharma',
  'priya.sharma@example.com',
  'Operations'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO visits (
  id,
  company_id,
  location_id,
  host_id,
  visitor_name,
  visitor_email,
  visitor_phone,
  purpose,
  expected_at
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'Alex Morgan',
  'alex.morgan@example.com',
  '+1 555 0123',
  'Vendor meeting',
  NOW() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;
