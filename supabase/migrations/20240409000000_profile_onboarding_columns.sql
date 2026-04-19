/**
 * Profile onboarding: status gating + photos, birth date, gender.
 * Existing profiles → 'complete'; new rows default 'pending' (handle_new_user INSERT picks up default).
 */
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_status text;

UPDATE public.profiles SET onboarding_status = 'complete' WHERE onboarding_status IS NULL;

ALTER TABLE public.profiles ALTER COLUMN onboarding_status SET DEFAULT 'pending';

UPDATE public.profiles SET onboarding_status = 'pending' WHERE onboarding_status IS NULL;

ALTER TABLE public.profiles ALTER COLUMN onboarding_status SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_onboarding_status_check
    CHECK (onboarding_status IN ('pending', 'complete', 'skipped'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
