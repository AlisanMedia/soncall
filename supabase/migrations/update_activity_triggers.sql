-- Update XP triggers to also set last_activity_timestamp
-- This ensures the online status is updated whenever agents perform actions

-- 1. Update Call Trigger
CREATE OR REPLACE FUNCTION handle_call_gamification() RETURNS TRIGGER AS $$
DECLARE
  v_total_calls INTEGER;
BEGIN
    -- Base XP: 20 per call + update activity timestamp
    UPDATE public.agent_progress
    SET total_xp = total_xp + 20, 
        last_activity_date = CURRENT_DATE,
        last_activity_timestamp = NOW()
    WHERE agent_id = NEW.agent_id;

    -- Update GOAL Progress
    UPDATE public.goals
    SET current_calls = current_calls + 1
    WHERE agent_id = NEW.agent_id 
    AND NOW() BETWEEN start_date AND end_date;

    -- Check for Call Achievement (100 calls)
    SELECT COUNT(*) INTO v_total_calls
    FROM public.lead_activity_log
    WHERE agent_id = NEW.agent_id;

    IF v_total_calls >= 100 THEN
        INSERT INTO public.achievements (agent_id, badge_type, earned_at)
        VALUES (NEW.agent_id, 'call_master', NOW())
        ON CONFLICT (agent_id, badge_type) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update Sale Trigger
CREATE OR REPLACE FUNCTION handle_sale_gamification() RETURNS TRIGGER AS $$
DECLARE
  v_total_sales INTEGER;
BEGIN
    -- Base XP: 100 for sale + update activity timestamp
    UPDATE public.agent_progress
    SET total_xp = total_xp + 100, 
        last_activity_date = CURRENT_DATE,
        last_activity_timestamp = NOW()
    WHERE agent_id = NEW.agent_id;

    -- Update GOAL Progress
    UPDATE public.goals
    SET current_sales = current_sales + 1
    WHERE agent_id = NEW.agent_id 
    AND NOW() BETWEEN start_date AND end_date;

    -- Check for Sales Achievement (10 sales)
    SELECT COUNT(*) INTO v_total_sales
    FROM public.sales
    WHERE agent_id = NEW.agent_id AND status = 'approved';

    IF v_total_sales >= 10 THEN
        INSERT INTO public.achievements (agent_id, badge_type, earned_at)
        VALUES (NEW.agent_id, 'sales_champion', NOW())
        ON CONFLICT (agent_id, badge_type) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update Appointment Trigger
CREATE OR REPLACE FUNCTION handle_appointment_gamification() RETURNS TRIGGER AS $$
DECLARE
  v_xp_amount INTEGER;
  v_total_appointments INTEGER;
BEGIN
    v_xp_amount := 50;

    -- Award XP + update activity timestamp
    UPDATE public.agent_progress
    SET total_xp = total_xp + v_xp_amount, 
        last_activity_date = CURRENT_DATE,
        last_activity_timestamp = NOW()
    WHERE agent_id = NEW.assigned_to;

    -- Update GOAL Progress
    UPDATE public.goals
    SET current_appointments = current_appointments + 1
    WHERE agent_id = NEW.assigned_to 
    AND NOW() BETWEEN start_date AND end_date;

    -- Check for Appointment Achievement (20 appointments)
    SELECT COUNT(*) INTO v_total_appointments
    FROM public.leads
    WHERE assigned_to = NEW.assigned_to AND status = 'appointment';

    IF v_total_appointments >= 20 THEN
        INSERT INTO public.achievements (agent_id, badge_type, earned_at)
        VALUES (NEW.assigned_to, 'appointment_setter', NOW())
        ON CONFLICT (agent_id, badge_type) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
