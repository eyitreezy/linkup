/**
 * Align media rows with web app — media_type + media_url on polymorphic media table.
 */
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS media_url TEXT;

UPDATE public.media
SET media_type = CASE
  WHEN mime_type ILIKE 'video/%' THEN 'video'
  ELSE 'image'
END
WHERE media_type IS NULL;

UPDATE public.media SET media_type = 'image' WHERE media_type IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media'
      AND column_name = 'media_type'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.media ALTER COLUMN media_type SET NOT NULL;
  END IF;
END $$;
