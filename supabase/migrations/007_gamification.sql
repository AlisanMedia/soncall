-- ============================================
-- Gamification & Goal System
-- ============================================

-- 1. Agent Progress Table (XP & Level)
CREATE TABLE IF NOT EXISTS public.agent_progress (
    agent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view progress" 
    ON public.agent_progress FOR SELECT 
    USING (true);

CREATE POLICY "System can update progress" 
    ON public.agent_progress FOR ALL 
    USING (true)
    WITH CHECK (true);

-- 2. Goals Table (Monthly Targets)
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL, -- Format: 'YYYY-MM'
    target_sales INTEGER DEFAULT 0,
    target_calls INTEGER DEFAULT 0,
    current_sales INTEGER DEFAULT 0,
    current_calls INTEGER DEFAULT 0,
    is_achieved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, period_key)
);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage all goals" 
    ON public.goals FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "Agents can view own goals" 
    ON public.goals FOR SELECT 
    USING (agent_id = auth.uid());

-- 3. Achievements Definitions
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sales', 'calls', 'streak', 'speed')),
    xp_reward INTEGER DEFAULT 100,
    condition_threshold INTEGER NOT NULL -- e.g. 100 calls
);

-- 4. Agent Achievements (Unlocked)
CREATE TABLE IF NOT EXISTS public.agent_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.agent_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view achievements" 
    ON public.agent_achievements FOR SELECT 
    USING (true);

-- Initial Achievements Data
INSERT INTO public.achievement_definitions (slug, title, description, icon_name, category, xp_reward, condition_threshold) 
VALUES 
    ('first_blood', 'İlk Satış', 'İlk başarılı satışını gerçekleştir.', 'Trophy', 'sales', 500, 1),
    ('warm_up', 'Isınma Turları', '10 arama yap.', 'Phone', 'calls', 100, 10),
    ('call_machine', 'Telefon Makinesi', '50 arama yap.', 'Zap', 'calls', 500, 50),
    ('closer', 'Kapanışçı', '3 satış kapat.', 'Target', 'sales', 1000, 3),
    ('on_fire', 'Alev Aldın', '3 gün üst üste satış yap.', 'Flame', 'streak', 1500, 3)
ON CONFLICT (slug) DO NOTHING;

-- Trigger to auto-create progress row for new agents? 
-- We'll handle this in application logic or a trigger on profiles insert if needed.
-- For now, let's create a function to initialize progress.

CREATE OR REPLACE FUNCTION initialize_agent_progress(uid UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.agent_progress (agent_id)
    VALUES (uid)
    ON CONFLICT (agent_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
