-- Reliable webhook lookup key for Flutterwave escrow fulfillment.
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS payment_tx_ref TEXT,
  ADD COLUMN IF NOT EXISTS flutterwave_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_payment_tx_ref
  ON public.escrow_transactions(payment_tx_ref)
  WHERE payment_tx_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escrow_fw_tx_id
  ON public.escrow_transactions(flutterwave_transaction_id)
  WHERE flutterwave_transaction_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
