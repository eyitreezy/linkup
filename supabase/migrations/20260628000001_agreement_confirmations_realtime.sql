-- Live agreement confirmation updates on PL6a (both parties must see counterparty confirm).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agreement_confirmations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.agreement_confirmations;
    END IF;
  END IF;
END $$;
