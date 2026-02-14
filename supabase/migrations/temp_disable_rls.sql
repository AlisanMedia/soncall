-- EMERGENCY FIX: Temporarily disable RLS on leads and profiles for debugging
-- This will help identify if RLS is the root cause of the 500 error

BEGIN;

-- Disable RLS temporarily on leads table
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Disable RLS temporarily on profiles table  
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- lead_activity_log already has permissive RLS, keep it as is

COMMIT;

-- TO REVERT: Run this to re-enable RLS
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
