-- Idempotency for Paystack webhooks (reference is unique per successful charge).

CREATE TABLE IF NOT EXISTS public.paystack_charge_processed (
  reference TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind = ANY (ARRAY['premium'::text, 'escrow'::text])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paystack_charge_user ON public.paystack_charge_processed (user_id, created_at DESC);

ALTER TABLE public.paystack_charge_processed ENABLE ROW LEVEL SECURITY;

-- No client access — Edge Functions use service role only.
