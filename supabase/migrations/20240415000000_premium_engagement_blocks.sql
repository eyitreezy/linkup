-- Premium subscription flag, plan engagement (views/saves), user blocks.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY['none'::text, 'active'::text, 'expired'::text]));

CREATE TABLE IF NOT EXISTS public.plan_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind = ANY (ARRAY['view'::text, 'save'::text])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_plan_engagements_plan ON public.plan_engagements (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_engagements_user ON public.plan_engagements (user_id);

ALTER TABLE public.plan_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_engagements_select ON public.plan_engagements;
CREATE POLICY plan_engagements_select ON public.plan_engagements FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_engagements.plan_id AND p.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS plan_engagements_insert ON public.plan_engagements;
CREATE POLICY plan_engagements_insert ON public.plan_engagements FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS plan_engagements_update ON public.plan_engagements;
CREATE POLICY plan_engagements_update ON public.plan_engagements FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS plan_engagements_delete ON public.plan_engagements;
CREATE POLICY plan_engagements_delete ON public.plan_engagements FOR DELETE
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select ON public.user_blocks;
CREATE POLICY user_blocks_select ON public.user_blocks FOR SELECT
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_insert ON public.user_blocks;
CREATE POLICY user_blocks_insert ON public.user_blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_delete ON public.user_blocks;
CREATE POLICY user_blocks_delete ON public.user_blocks FOR DELETE
  USING (blocker_id = auth.uid());
