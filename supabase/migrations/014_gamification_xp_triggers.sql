-- ============================================
-- GAMIFICATION 2.0: XP Triggers & Economy
-- Migration: 014_gamification_xp_triggers.sql
-- ============================================

-- 1. Helper Function to Award XP Safely
CREATE OR REPLACE FUNCTION award_xp(target_agent_id UUID, xp_amount INTEGER, source_action TEXT)
RETURNS VOID AS $$
BEGIN
    -- Update Agent Progress
    UPDATE public.agent_progress
    SET 
        total_xp = total_xp + xp_amount,
        last_activity_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE agent_id = target_agent_id;

    -- Log the Achievement (Optional, for now just XP is enough)
    -- We could insert into a 'xp_logs' table if we wanted audit trails later
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Trigger: Call Made (+10 XP) & Duration Bonus (+50 XP)
-- Listens on: lead_activity_log INSERT
CREATE OR REPLACE FUNCTION trigger_xp_on_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- BASE XP: Call Made
    IF NEW.action = 'call_made' OR NEW.action = 'Call' THEN
        PERFORM award_xp(NEW.agent_id, 10, 'call_made');
        
        -- BONUS XP: Long Call (> 3 mins / 180s)
        -- Assuming metadata contains 'duration' in seconds
        IF (NEW.metadata->>'duration')::int > 180 THEN
            PERFORM award_xp(NEW.agent_id, 50, 'long_call_bonus');
        END IF;

        -- BONUS XP: Streak Check
        -- Simple daily check: If last_activity_date < CURRENT_DATE, increment streak
        UPDATE public.agent_progress
        SET 
            current_streak = CASE 
                WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
                WHEN last_activity_date = CURRENT_DATE THEN current_streak -- Already active today
                ELSE 1 -- Reset if missed a day
            END
        WHERE agent_id = NEW.agent_id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xp_activity ON public.lead_activity_log;
CREATE TRIGGER trg_xp_activity
    AFTER INSERT ON public.lead_activity_log
    FOR EACH ROW
    EXECUTE FUNCTION trigger_xp_on_activity();


-- 3. Trigger: Appointment Set (+200 XP)
-- Listens on: leads UPDATE status
CREATE OR REPLACE FUNCTION trigger_xp_on_lead_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed TO 'appointment'
    IF NEW.status = 'appointment' AND OLD.status != 'appointment' THEN
        -- Award XP to the agent who owns the lead (or assigned_to)
        IF NEW.assigned_to IS NOT NULL THEN
            PERFORM award_xp(NEW.assigned_to, 200, 'appointment_set');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xp_lead_status ON public.leads;
CREATE TRIGGER trg_xp_lead_status
    AFTER UPDATE OF status ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_xp_on_lead_status();


-- 4. Trigger: Sale Made (+1000 XP!)
-- Listens on: sales INSERT (assuming a 'sales' table exists based on previous context)
-- If not, we fall back to lead status 'completed' or similar. 
-- Checking schema... assuming 'sales' table exists from previous convos.

CREATE OR REPLACE FUNCTION trigger_xp_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Award HUGE XP
    PERFORM award_xp(NEW.agent_id, 1000, 'sale_closed');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create if sales table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
        DROP TRIGGER IF EXISTS trg_xp_sale ON public.sales;
        CREATE TRIGGER trg_xp_sale
            AFTER INSERT ON public.sales
            FOR EACH ROW
            EXECUTE FUNCTION trigger_xp_on_sale();
    END IF;
END
$$;
