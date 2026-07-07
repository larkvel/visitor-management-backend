-- Add subdomain column to companies table for URL-based company access
ALTER TABLE companies ADD COLUMN subdomain VARCHAR(50) UNIQUE;

-- Create index for faster subdomain lookups
CREATE INDEX idx_companies_subdomain ON companies(subdomain);
