-- Visible Expo push token columns (also mirrored in preferences JSON for backward compatibility).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
  ADD COLUMN IF NOT EXISTS expo_push_token_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.expo_push_token IS 'ExponentPushToken[...] for Expo Push API; set by mobile app on sign-in.';
COMMENT ON COLUMN public.profiles.expo_push_token_updated_at IS 'Last time expo_push_token was refreshed from the device.';
