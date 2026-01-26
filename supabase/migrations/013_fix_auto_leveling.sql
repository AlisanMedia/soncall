-- ============================================
-- GAMIFICATION FIX: Auto-Level Calculation
-- Migration: 013_fix_auto_leveling.sql
-- Purpose: Automatically update current_level based on total_xp
-- ============================================

-- 1. Create Auto-Level Function
CREATE OR REPLACE FUNCTION auto_update_agent_level() 
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically calculate level from total XP
    -- Formula: level = floor(xp / 1000) + 1
    -- 
    -- Level Thresholds:
    -- Level 1: 0 - 999 XP
    -- Level 2: 1000 - 1999 XP
    -- Level 3: 2000 - 2999 XP
    -- ...and so on
    --
    -- Using GREATEST to ensure level never goes below 1
    NEW.current_level := GREATEST(1, FLOOR(NEW.total_xp / 1000::float) + 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach Trigger to agent_progress
-- This will fire BEFORE any UPDATE that changes total_xp
DROP TRIGGER IF EXISTS trg_auto_level_up ON public.agent_progress;

CREATE TRIGGER trg_auto_level_up
    BEFORE UPDATE OF total_xp ON public.agent_progress
    FOR EACH ROW
    WHEN (NEW.total_xp != OLD.total_xp)
    EXECUTE FUNCTION auto_update_agent_level();

-- 3. Backfill Existing Data
-- Fix all existing agents that may be stuck at incorrect levels
UPDATE public.agent_progress
SET 
    current_level = GREATEST(1, FLOOR(total_xp / 1000::float) + 1),
    updated_at = NOW();

-- 4. Verification Query (To run after migration)
-- SELECT agent_id, total_xp, current_level, 
--        GREATEST(1, FLOOR(total_xp / 1000::float) + 1) as calculated_level
-- FROM public.agent_progress
-- ORDER BY total_xp DESC;

-- ============================================
-- EXPECTED RESULTS AFTER MIGRATION:
-- ============================================
-- total_xp | current_level | Status
-- ---------|--------------|--------
--    0     |      1       | ✅
--  500     |      1       | ✅
--  999     |      1       | ✅
-- 1000     |      2       | ✅
-- 1500     |      2       | ✅
-- 1999     |      2       | ✅
-- 2000     |      3       | ✅
-- ============================================
