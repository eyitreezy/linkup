-- Privacy policy versions + per-user consent audit trail + re-consent helper.

CREATE TABLE IF NOT EXISTS public.privacy_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  summary_of_changes TEXT,
  effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_policy_versions_effective
  ON public.privacy_policy_versions (effective_date DESC);

ALTER TABLE public.privacy_policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_policy_versions"
  ON public.privacy_policy_versions FOR SELECT
  USING (true);

CREATE POLICY "admin_can_insert_policy_versions"
  ON public.privacy_policy_versions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_current_privacy_policy_version()
RETURNS public.privacy_policy_versions AS $$
  SELECT * FROM public.privacy_policy_versions ORDER BY effective_date DESC LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.privacy_policy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  policy_version_id UUID NOT NULL REFERENCES public.privacy_policy_versions(id),
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_method TEXT NOT NULL DEFAULT 'signup'
    CHECK (consent_method IN ('signup', 're_consent')),
  UNIQUE(user_id, policy_version_id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_policy_consents_user
  ON public.privacy_policy_consents (user_id, consented_at DESC);

ALTER TABLE public.privacy_policy_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_consents"
  ON public.privacy_policy_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_consent"
  ON public.privacy_policy_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_reads_all_consents"
  ON public.privacy_policy_consents FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.user_needs_privacy_reconsent(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  _current_version_id UUID;
  _has_consented BOOLEAN;
BEGIN
  SELECT id INTO _current_version_id FROM public.privacy_policy_versions
    ORDER BY effective_date DESC LIMIT 1;

  IF _current_version_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.privacy_policy_consents
    WHERE user_id = p_user_id AND policy_version_id = _current_version_id
  ) INTO _has_consented;

  RETURN NOT _has_consented;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.user_needs_privacy_reconsent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_privacy_policy_version() TO anon, authenticated;
