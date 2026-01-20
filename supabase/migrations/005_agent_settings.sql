
-- 1. Modify profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'purple',
ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Create Avatars Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for Avatars

-- Allow public access to view avatars
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatar
-- We enforce the filename convention or folder structure via client logic, 
-- but strict RLS on storage.objects for "own file" is tricky without using folders matching user IDs.
-- Simplified: Authenticated users can upload to avatars.
DROP POLICY IF EXISTS "Auth users can upload avatars" ON storage.objects;
CREATE POLICY "Auth users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' );

-- Allow users to update/delete their own avatars (assuming they manage their own files)
DROP POLICY IF EXISTS "Auth users can update own avatars" ON storage.objects;
CREATE POLICY "Auth users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND owner = auth.uid() );

DROP POLICY IF EXISTS "Auth users can delete own avatars" ON storage.objects;
CREATE POLICY "Auth users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND owner = auth.uid() );
