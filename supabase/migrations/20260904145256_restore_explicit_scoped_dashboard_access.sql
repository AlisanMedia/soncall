-- Reviewable targeted repair. No data rows are modified.
-- Restores market boundaries removed by the September 4 emergency SQL.
DROP POLICY IF EXISTS "Leads manager manage" ON public.leads;
DROP POLICY IF EXISTS "Leads manager select" ON public.leads;
-- Existing market-scoped manager ALL and agent SELECT/UPDATE policies remain.

DROP POLICY IF EXISTS "Activity log select all authenticated" ON public.lead_activity_log;
DROP POLICY IF EXISTS "Activity log insert authenticated" ON public.lead_activity_log;
DROP POLICY IF EXISTS "Activity log update authenticated" ON public.lead_activity_log;
DROP POLICY IF EXISTS "Authenticated can insert activity logs" ON public.lead_activity_log;
DROP POLICY IF EXISTS "Lead activity market isolated select" ON public.lead_activity_log;
CREATE POLICY "Activity scoped read" ON public.lead_activity_log
FOR SELECT TO authenticated USING (
  public.is_global_user()
  OR (agent_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_activity_log.lead_id
    AND (
      l.assigned_to = auth.uid() OR l.sdr_id = auth.uid()
      OR l.closer_id = auth.uid() OR l.current_agent_id = auth.uid()
      OR (public.is_market_manager() AND l.market_id = public.current_user_market_id())
    )
  )
);
CREATE POLICY "Activity scoped insert" ON public.lead_activity_log
FOR INSERT TO authenticated WITH CHECK (
  agent_id = auth.uid()
  AND (
    public.is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_activity_log.lead_id
      AND (
        l.assigned_to = auth.uid() OR l.sdr_id = auth.uid()
        OR l.closer_id = auth.uid() OR l.current_agent_id = auth.uid()
        OR (public.is_market_manager() AND l.market_id = public.current_user_market_id())
      )
    )
  )
);
-- Application appends activity entries; no public UPDATE/DELETE is required.

DROP POLICY IF EXISTS "Profiles manage" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Privileged users can insert profiles" ON public.profiles;
CREATE POLICY "Profiles scoped select" ON public.profiles
FOR SELECT TO authenticated USING (
  id = auth.uid() OR public.is_global_user()
  OR market_id = public.current_user_market_id()
);
-- Existing market-scoped UPDATE remains, protected by trigger below.
-- User creation/deletion is performed by checked server routes with service_role.

CREATE OR REPLACE FUNCTION public.guard_profile_authorization_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor_role text;
  actor_market uuid;
BEGIN
  -- Service/database administration is trusted; JWT claims are not used to bypass.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '42501';
  END IF;
  SELECT p.role::text,p.market_id INTO actor_role,actor_market
  FROM public.profiles p WHERE p.id = auth.uid();
  IF (actor_role = 'manager' AND OLD.id <> auth.uid() AND OLD.role::text <> 'agent')
     OR (actor_role = 'admin' AND OLD.role::text = 'founder') THEN
    RAISE EXCEPTION 'Cannot edit a higher privilege profile' USING ERRCODE = '42501';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.market_id IS DISTINCT FROM OLD.market_id
     OR NEW.sales_role IS DISTINCT FROM OLD.sales_role
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
    IF NEW.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change own role' USING ERRCODE = '42501';
    END IF;
    IF actor_role = 'founder' THEN
      RETURN NEW;
    ELSIF actor_role = 'admin' AND OLD.role::text <> 'founder' AND NEW.role::text <> 'founder' THEN
      RETURN NEW;
    ELSIF actor_role = 'manager'
          AND OLD.role::text = 'agent' AND NEW.role::text = 'agent'
          AND OLD.market_id = actor_market
          AND NEW.market_id IS NOT DISTINCT FROM OLD.market_id THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Cannot change protected profile fields' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_profile_authorization_changes ON public.profiles;
CREATE TRIGGER guard_profile_authorization_changes
BEFORE UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_authorization_changes();
