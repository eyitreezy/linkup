-- Group plans: one escrow row per accepted guest (composite unique on plan_id + guest_id)

ALTER TABLE public.escrow_transactions
  DROP CONSTRAINT IF EXISTS escrow_transactions_plan_id_key;

ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.plan_offers (id) ON DELETE SET NULL;

ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS group_plan_index INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'escrow_transactions_plan_guest_unique'
  ) THEN
    ALTER TABLE public.escrow_transactions
      ADD CONSTRAINT escrow_transactions_plan_guest_unique
      UNIQUE (plan_id, guest_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_plan_guest
  ON public.escrow_transactions (plan_id, guest_id);

COMMENT ON COLUMN public.escrow_transactions.offer_id IS 'Accepted plan_offer for this guest escrow (group plans).';
COMMENT ON COLUMN public.escrow_transactions.group_plan_index IS 'Display order for group plan escrow rows.';

NOTIFY pgrst, 'reload schema';
