-- Add pending_email column to profiles for email change requests
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_email TEXT;
