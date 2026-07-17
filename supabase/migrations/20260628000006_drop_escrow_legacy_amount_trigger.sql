-- Fix escrow fund failures: orphan BEFORE trigger references dropped `amount` column (PostgreSQL 42703).
-- Safe to run multiple times.

DROP TRIGGER IF EXISTS tr_escrow_legacy_amount_fill ON public.escrow_transactions;
DROP TRIGGER IF EXISTS tr_escrow_sync_amount_from_cents ON public.escrow_transactions;

DROP FUNCTION IF EXISTS public.tr_escrow_legacy_amount_fill();
DROP FUNCTION IF EXISTS public.tr_escrow_sync_amount_from_cents();

-- Verify nothing on escrow_transactions still references NEW.amount in a BEFORE trigger.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname, p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'escrow_transactions'
      AND NOT t.tgisinternal
      AND pg_get_functiondef(p.oid) ILIKE '%new.amount%'
  LOOP
    RAISE NOTICE 'Dropping trigger % on escrow_transactions (function %)', r.tgname, r.proname;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.escrow_transactions', r.tgname);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
