/**
 * Negotiation: offer expiry, proposed meet time, expired status.
 */
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS proposed_scheduled_at TIMESTAMPTZ;

-- Default expiry for new rows (24h) — app may override on insert.
ALTER TABLE public.plan_offers
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

DO $$
BEGIN
  ALTER TYPE public.offer_status ADD VALUE 'expired';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.plan_offers.expires_at IS 'Offer validity; UI treats past expires_at as expired for pending offers.';
COMMENT ON COLUMN public.plan_offers.proposed_scheduled_at IS 'Optional counterparty-proposed meet time for this offer round.';
