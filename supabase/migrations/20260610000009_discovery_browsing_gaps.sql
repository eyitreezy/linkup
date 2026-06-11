-- Discovery browsing gaps: hidden plans (Gold+), Platinum privacy toggles.

CREATE TABLE IF NOT EXISTS public.hidden_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_plans_user ON public.hidden_plans (user_id, hidden_at DESC);

ALTER TABLE public.hidden_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hidden_plans_own ON public.hidden_plans;
CREATE POLICY hidden_plans_own ON public.hidden_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS incognito_browse_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_view_privacy_enabled boolean NOT NULL DEFAULT false;
