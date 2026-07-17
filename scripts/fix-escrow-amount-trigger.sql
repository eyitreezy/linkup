-- Run in Supabase SQL Editor if escrow webhook fails with:
--   record "new" has no field "amount"  (code 42703)

DROP TRIGGER IF EXISTS tr_escrow_legacy_amount_fill ON public.escrow_transactions;
DROP TRIGGER IF EXISTS tr_escrow_sync_amount_from_cents ON public.escrow_transactions;
DROP FUNCTION IF EXISTS public.tr_escrow_legacy_amount_fill();
DROP FUNCTION IF EXISTS public.tr_escrow_sync_amount_from_cents();

-- Confirm trigger is gone (should return 0 rows):
-- SELECT tgname FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- WHERE c.relname = 'escrow_transactions' AND tgname = 'tr_escrow_legacy_amount_fill';

NOTIFY pgrst, 'reload schema';
