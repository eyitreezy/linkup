-- Bank transfer escrow funding via Flutterwave dynamic virtual accounts.

CREATE TABLE IF NOT EXISTS public.nigerian_banks (
  bank_code TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO public.nigerian_banks (bank_code, bank_name) VALUES
  ('044', 'Access Bank'),
  ('023', 'Citibank Nigeria'),
  ('050', 'EcoBank Nigeria'),
  ('070', 'Fidelity Bank'),
  ('011', 'First Bank of Nigeria'),
  ('214', 'First City Monument Bank'),
  ('058', 'Guaranty Trust Bank'),
  ('030', 'Heritage Bank'),
  ('082', 'Keystone Bank'),
  ('526', 'Moniepoint MFB'),
  ('076', 'Polaris Bank'),
  ('101', 'Providus Bank'),
  ('221', 'Stanbic IBTC Bank'),
  ('068', 'Standard Chartered Bank'),
  ('232', 'Sterling Bank'),
  ('032', 'Union Bank of Nigeria'),
  ('033', 'United Bank for Africa'),
  ('215', 'Unity Bank'),
  ('035', 'Wema Bank'),
  ('057', 'Zenith Bank'),
  ('999992', 'Opay'),
  ('999991', 'Palmpay'),
  ('999994', 'Kuda Bank'),
  ('50515', 'Carbon')
ON CONFLICT (bank_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL REFERENCES public.nigerian_banks(bank_code),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  ndpr_consent_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, account_number, bank_code)
);

ALTER TABLE public.user_payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_payment_accounts ON public.user_payment_accounts;
CREATE POLICY user_own_payment_accounts
  ON public.user_payment_accounts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.virtual_account_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  flutterwave_order_ref TEXT NOT NULL UNIQUE,
  refund_account_id UUID REFERENCES public.user_payment_accounts(id),
  one_time_refund_bank_code TEXT,
  one_time_refund_account_number TEXT,
  one_time_refund_account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'funded', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes'
);

ALTER TABLE public.virtual_account_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_read_own_va_sessions ON public.virtual_account_sessions;
CREATE POLICY user_read_own_va_sessions
  ON public.virtual_account_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_va_sessions_order_ref
  ON public.virtual_account_sessions(flutterwave_order_ref);
CREATE INDEX IF NOT EXISTS idx_va_sessions_escrow
  ON public.virtual_account_sessions(escrow_id);

ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('card', 'bank_transfer')),
  ADD COLUMN IF NOT EXISTS sender_bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS sender_bank_code TEXT,
  ADD COLUMN IF NOT EXISTS sender_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS refund_account_id UUID
    REFERENCES public.user_payment_accounts(id),
  ADD COLUMN IF NOT EXISTS refund_status TEXT
    CHECK (refund_status IN ('not_applicable', 'initiated', 'completed'))
    DEFAULT 'not_applicable';

ALTER TABLE public.nigerian_banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nigerian_banks_read ON public.nigerian_banks;
CREATE POLICY nigerian_banks_read
  ON public.nigerian_banks FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

DO $realtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'virtual_account_sessions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_account_sessions;
    END IF;
  END IF;
END;
$realtime$;

NOTIFY pgrst, 'reload schema';
