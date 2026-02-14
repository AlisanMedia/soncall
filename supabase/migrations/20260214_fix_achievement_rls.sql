
-- FIX: Enable RLS on achievement_definitions to resolve security warning
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;

-- 1. Everyone (Agents & Managers) can SEE the definitions
DROP POLICY IF EXISTS "Anyone can view definitions" ON public.achievement_definitions;
CREATE POLICY "Anyone can view definitions" 
ON public.achievement_definitions FOR SELECT 
TO authenticated 
USING (true);

-- 2. Only Admins/Founders can MODIFY them (Add new badges, change XP)
DROP POLICY IF EXISTS "Admins can manage definitions" ON public.achievement_definitions;
CREATE POLICY "Admins can manage definitions" 
ON public.achievement_definitions FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'founder')
    )
);
