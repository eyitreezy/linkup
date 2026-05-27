/**
 * Mood plan lifecycle: is_expired, archive timestamp, visibility RLS,
 * creator edit lock, offer/escrow freeze, sweep RPC for cron/Edge.
 */
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_expired BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS creator_can_manage BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.plans.is_expired IS 'Mood TTL reached — hidden from public discover; creator/admin only.';
COMMENT ON COLUMN public.plans.creator_can_manage IS 'Reserved for future capability toggles; default true.';
COMMENT ON COLUMN public.plans.archived_at IS 'Creator soft-archive; hidden from public discover (creator still sees in management).';

CREATE INDEX IF NOT EXISTS idx_plans_creator_archived
  ON public.plans (creator_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_plans_mood_expiry_sweep
  ON public.plans (is_mood_plan, is_expired, mood_expires_at)
  WHERE is_mood_plan = true;

UPDATE public.plans p
SET
  is_expired = true,
  auto_expiry_at = COALESCE(p.auto_expiry_at, p.mood_expires_at, now()),
  updated_at = now()
WHERE p.is_mood_plan = true
  AND p.mood_expires_at IS NOT NULL
  AND p.mood_expires_at <= now()
  AND COALESCE(p.is_expired, false) = false;

-- ---------------------------------------------------------------------------
-- SELECT visibility (mood expired → only creator + admin; archived → same for public)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_uid_can_see_plan(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  pl RECORD;
  mood_dead boolean;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT
    p.creator_id,
    p.visibility,
    COALESCE(p.is_suppressed, false) AS is_suppressed,
    COALESCE(p.is_mood_plan, false) AS is_mood_plan,
    COALESCE(p.is_expired, false) AS is_expired,
    p.mood_expires_at,
    p.archived_at
  INTO pl
  FROM public.plans p
  WHERE p.id = p_plan_id;

  IF pl.creator_id IS NULL THEN
    RETURN false;
  END IF;

  IF pl.creator_id = auth.uid() OR public.is_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  mood_dead :=
    pl.is_mood_plan
    AND (
      pl.is_expired
      OR (pl.mood_expires_at IS NOT NULL AND pl.mood_expires_at <= now())
    );

  IF mood_dead THEN
    RETURN false;
  END IF;

  IF pl.archived_at IS NOT NULL THEN
    RETURN false;
  END IF;

  RETURN (
    (
      pl.visibility IN ('public', 'radius')
      AND pl.is_suppressed = false
    )
    OR EXISTS (
      SELECT 1
      FROM public.plan_offers o
      WHERE o.plan_id = p_plan_id
        AND o.bidder_id = auth.uid()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auth_uid_can_see_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_see_plan(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Creator edit lock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_row_locked_for_creator_edit(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
DECLARE
  pl RECORD;
  esc_disputed boolean;
BEGIN
  SELECT
    COALESCE(p.is_expired, false) AS is_expired,
    COALESCE(p.is_mood_plan, false) AS is_mood_plan,
    p.mood_expires_at,
    p.status,
    p.archived_at
  INTO pl
  FROM public.plans p
  WHERE p.id = p_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF pl.archived_at IS NOT NULL THEN
    RETURN true;
  END IF;
  IF pl.is_expired THEN
    RETURN true;
  END IF;
  IF pl.is_mood_plan AND pl.mood_expires_at IS NOT NULL AND pl.mood_expires_at <= now() THEN
    RETURN true;
  END IF;
  IF pl.status = 'completed'::public.plan_status THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.escrow_transactions e
    WHERE e.plan_id = p_id
      AND e.status = 'disputed'::public.escrow_status
  )
  INTO esc_disputed;

  IF esc_disputed THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.plan_row_locked_for_creator_edit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_row_locked_for_creator_edit(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS plans_update_creator ON public.plans;
CREATE POLICY plans_update_creator ON public.plans FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR (
      creator_id = auth.uid()
      AND NOT public.plan_row_locked_for_creator_edit(id)
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR creator_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Negotiation freeze after mood TTL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_mood_negotiation_closed(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
DECLARE
  pl RECORD;
BEGIN
  SELECT
    COALESCE(p.is_mood_plan, false) AS is_mood_plan,
    COALESCE(p.is_expired, false) AS is_expired,
    p.mood_expires_at
  INTO pl
  FROM public.plans p
  WHERE p.id = p_plan_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;
  IF NOT pl.is_mood_plan THEN
    RETURN false;
  END IF;
  IF pl.is_expired THEN
    RETURN true;
  END IF;
  IF pl.mood_expires_at IS NOT NULL AND pl.mood_expires_at <= now() THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.tr_enforce_plan_offers_mood_ttl()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF public.plan_mood_negotiation_closed(NEW.plan_id) THEN
    RAISE EXCEPTION 'This mood moment has ended — negotiation is closed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_plan_offers_mood_ttl ON public.plan_offers;
CREATE TRIGGER tr_plan_offers_mood_ttl
  BEFORE INSERT OR UPDATE ON public.plan_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_enforce_plan_offers_mood_ttl();

-- ---------------------------------------------------------------------------
-- Escrow freeze for expired mood (admins may still adjust)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_escrow_frozen(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
DECLARE
  pl RECORD;
BEGIN
  SELECT
    COALESCE(p.is_mood_plan, false) AS is_mood_plan,
    COALESCE(p.is_expired, false) AS is_expired,
    p.mood_expires_at
  INTO pl
  FROM public.plans p
  WHERE p.id = p_plan_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;
  IF NOT pl.is_mood_plan THEN
    RETURN false;
  END IF;
  IF pl.is_expired THEN
    RETURN true;
  END IF;
  IF pl.mood_expires_at IS NOT NULL AND pl.mood_expires_at <= now() THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

DROP POLICY IF EXISTS escrow_update ON public.escrow_transactions;
CREATE POLICY escrow_update ON public.escrow_transactions FOR UPDATE
  USING (
   public.is_admin(auth.uid())
    OR (
      (payer_id = auth.uid() OR payee_id = auth.uid())
      AND NOT public.plan_escrow_frozen(plan_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Cron / Edge: mark TTL mood rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_mood_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.plans p
  SET
    is_expired = true,
    auto_expiry_at = COALESCE(p.auto_expiry_at, p.mood_expires_at, now()),
    updated_at = now(),
    status = CASE
      WHEN p.status = 'negotiating'::public.plan_status THEN 'cancelled'::public.plan_status
      ELSE p.status
    END
  WHERE p.is_mood_plan = true
    AND p.mood_expires_at IS NOT NULL
    AND p.mood_expires_at <= now()
    AND COALESCE(p.is_expired, false) = false;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_expired_mood_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_expired_mood_plans() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_expired_mood_plans() TO postgres;

REVOKE ALL ON FUNCTION public.auth_uid_can_see_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_see_plan(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
