/**
 * Discover pass list — live hidden_plans INSERT for swipe-left sync.
 */
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hidden_plans'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.hidden_plans;
    END IF;
  END IF;
END $$;
