/**
 * Human-readable home / base location for profiles (onboarding + discovery).
 * Coordinates live in latitude / longitude; this is the display label from search or GPS.
 */
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_label text;

COMMENT ON COLUMN public.profiles.location_label IS
  'User-facing location (city/area) from onboarding search or current-location pick.';
