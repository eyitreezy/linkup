/**
 * Profile primary photo + profile video (media table).
 * Backward compatible: photo_urls and avatar_url continue to work.
 */

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_photo_url TEXT;

-- Backfill primary from existing gallery / avatar
UPDATE public.profiles
SET primary_photo_url = COALESCE(
  NULLIF(trim(primary_photo_url), ''),
  CASE WHEN photo_urls IS NOT NULL AND array_length(photo_urls, 1) > 0 THEN photo_urls[1] END,
  NULLIF(trim(avatar_url), '')
)
WHERE primary_photo_url IS NULL OR trim(primary_photo_url) = '';

UPDATE public.profiles
SET avatar_url = COALESCE(NULLIF(trim(avatar_url), ''), primary_photo_url)
WHERE (avatar_url IS NULL OR trim(avatar_url) = '') AND primary_photo_url IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-videos', 'profile-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Profile video uploads" ON storage.objects;
CREATE POLICY "Profile video uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-videos' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Profile video update own" ON storage.objects;
CREATE POLICY "Profile video update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-videos' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Profile video delete own" ON storage.objects;
CREATE POLICY "Profile video delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-videos' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Profile video read" ON storage.objects;
CREATE POLICY "Profile video read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-videos');

-- Extend media RLS for profile videos (parent_table = 'profiles', parent_id = user_id)
DROP POLICY IF EXISTS media_select ON public.media;
CREATE POLICY media_select ON public.media FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR (
      parent_table = 'messages'
      AND EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        WHERE m.id = media.parent_id
          AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    )
    OR (
      parent_table = 'profiles'
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.user_id = media.parent_id
          AND (pr.user_id = auth.uid() OR pr.is_profile_public = true)
      )
    )
  );

DROP POLICY IF EXISTS media_insert ON public.media;
CREATE POLICY media_insert ON public.media FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS media_update ON public.media;
CREATE POLICY media_update ON public.media FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS media_delete ON public.media;
CREATE POLICY media_delete ON public.media FOR DELETE
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
