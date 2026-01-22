-- ============================================
-- EMAIL CHANGE SCRIPT (SAFE UPDATE)
-- ============================================

-- 1. Update the email in the Auth table (This is the critical login email)
-- NOTE: This usually requires Superuser/Database Owner permissions in Supabase SQL Editor
UPDATE auth.users
SET email = 'alisangul123@gmail.com',
    updated_at = NOW()
WHERE email = 'manager@artificagent.com';

-- 2. Update the email in the Public Profiles table (For display)
UPDATE public.profiles
SET email = 'alisangul123@gmail.com',
    updated_at = NOW()
WHERE email = 'manager@artificagent.com';

-- 3. Confirm the new email automatically (so you don't have to verify it via inbox)
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'alisangul123@gmail.com';
