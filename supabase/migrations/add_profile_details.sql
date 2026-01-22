-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tc_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(4, 1) DEFAULT 0;

-- Index for faster lookups if needed (though UUID is primary)
CREATE INDEX IF NOT EXISTS idx_profiles_tc_number ON profiles(tc_number);
