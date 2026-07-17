-- Align nigerian_banks codes with Flutterwave account resolution directory.
-- Codes confirmed against Flutterwave GET /v3/banks/NG and NIBSS references:
-- Moniepoint 50515, Kuda 50211, Carbon 100026.

ALTER TABLE public.nigerian_banks
  ADD COLUMN IF NOT EXISTS supports_account_resolution
  BOOLEAN NOT NULL DEFAULT TRUE;

-- Carbon occupied Flutterwave code 50515 in the seed; move it before Moniepoint takes 50515.
UPDATE public.user_payment_accounts
  SET bank_code = '100026'
  WHERE bank_code = '50515';

UPDATE public.virtual_account_sessions
  SET bank_code = '100026'
  WHERE bank_code = '50515';

UPDATE public.virtual_account_sessions
  SET one_time_refund_bank_code = '100026'
  WHERE one_time_refund_bank_code = '50515';

UPDATE public.escrow_transactions
  SET sender_bank_code = '100026'
  WHERE sender_bank_code = '50515';

UPDATE public.nigerian_banks
  SET bank_code = '100026', bank_name = 'Carbon'
  WHERE bank_code = '50515';

UPDATE public.user_payment_accounts
  SET bank_code = '50515'
  WHERE bank_code = '526';

UPDATE public.virtual_account_sessions
  SET bank_code = '50515'
  WHERE bank_code = '526';

UPDATE public.virtual_account_sessions
  SET one_time_refund_bank_code = '50515'
  WHERE one_time_refund_bank_code = '526';

UPDATE public.escrow_transactions
  SET sender_bank_code = '50515'
  WHERE sender_bank_code = '526';

UPDATE public.nigerian_banks
  SET bank_code = '50515', bank_name = 'Moniepoint MFB'
  WHERE bank_code = '526';

UPDATE public.user_payment_accounts
  SET bank_code = '50211'
  WHERE bank_code = '999994';

UPDATE public.virtual_account_sessions
  SET bank_code = '50211'
  WHERE bank_code = '999994';

UPDATE public.virtual_account_sessions
  SET one_time_refund_bank_code = '50211'
  WHERE one_time_refund_bank_code = '999994';

UPDATE public.escrow_transactions
  SET sender_bank_code = '50211'
  WHERE sender_bank_code = '999994';

UPDATE public.nigerian_banks
  SET bank_code = '50211', bank_name = 'Kuda Bank'
  WHERE bank_code = '999994';

-- Pooled mobile-money wallets: Flutterwave cannot resolve individual account numbers.
UPDATE public.nigerian_banks
  SET supports_account_resolution = FALSE
  WHERE bank_code IN ('999992', '999991');

CREATE INDEX IF NOT EXISTS idx_nigerian_banks_active_resolvable
  ON public.nigerian_banks(is_active, supports_account_resolution);

NOTIFY pgrst, 'reload schema';
