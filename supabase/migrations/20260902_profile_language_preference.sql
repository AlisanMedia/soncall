-- ============================================
-- Personal Panel Language Preference
-- Date: 2026-09-02
-- ============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

UPDATE public.profiles
SET preferred_language = COALESCE(preferred_language, 'tr')
WHERE preferred_language IS NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_preferred_language_check
CHECK (preferred_language IN ('tr', 'en', 'de', 'ru', 'ar'));
