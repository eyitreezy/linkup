/**
 * Plan create UX: catalog types allow escrow patterns A/B/C (matches UI always showing three options).
 * Authenticated users may insert custom meet types (created_by = auth.uid()).
 */
ALTER TABLE public.meet_types
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.meet_types.created_by IS 'NULL = seeded/catalog row; set for user-created meet types.';

UPDATE public.meet_types
SET allowed_patterns = ARRAY['A', 'B', 'C']::TEXT[]
WHERE allowed_patterns IS DISTINCT FROM ARRAY['A', 'B', 'C']::TEXT[];

DROP POLICY IF EXISTS meet_types_insert_user ON public.meet_types;
CREATE POLICY meet_types_insert_user ON public.meet_types
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by IS NOT NULL
    AND created_by = auth.uid()
    AND is_active IS TRUE
  );
