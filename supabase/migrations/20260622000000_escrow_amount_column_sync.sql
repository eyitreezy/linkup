-- Repair failed partial run of this migration and normalize escrow amount columns.
-- Safe on standard schemas (amount_cents only) and legacy schemas (amount only / both).

DROP TRIGGER IF EXISTS tr_escrow_sync_amount_from_cents ON public.escrow_transactions;
DROP FUNCTION IF EXISTS public.tr_escrow_sync_amount_from_cents();

ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- Legacy projects may have NOT NULL `amount` (kobo) instead of amount_cents.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escrow_transactions' AND column_name = 'amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escrow_transactions' AND column_name = 'amount_cents'
  ) THEN
    ALTER TABLE public.escrow_transactions RENAME COLUMN amount TO amount_cents;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escrow_transactions' AND column_name = 'amount'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escrow_transactions' AND column_name = 'amount_cents'
  ) THEN
    UPDATE public.escrow_transactions
    SET amount_cents = amount
    WHERE amount_cents IS NULL AND amount IS NOT NULL;

    UPDATE public.escrow_transactions
    SET amount = amount_cents
    WHERE amount IS NULL AND amount_cents IS NOT NULL;

    ALTER TABLE public.escrow_transactions DROP COLUMN amount;
  END IF;
END $$;

-- If a legacy `amount` column still exists, mirror amount_cents on write (client sends amount_cents).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escrow_transactions' AND column_name = 'amount'
  ) THEN
    CREATE OR REPLACE FUNCTION public.tr_escrow_legacy_amount_fill()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      IF NEW.amount IS NULL AND NEW.amount_cents IS NOT NULL THEN
        NEW.amount := NEW.amount_cents;
      ELSIF NEW.amount_cents IS NULL AND NEW.amount IS NOT NULL THEN
        NEW.amount_cents := NEW.amount;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS tr_escrow_legacy_amount_fill ON public.escrow_transactions;
    CREATE TRIGGER tr_escrow_legacy_amount_fill
      BEFORE INSERT OR UPDATE ON public.escrow_transactions
      FOR EACH ROW
      EXECUTE FUNCTION public.tr_escrow_legacy_amount_fill();
  ELSE
    DROP TRIGGER IF EXISTS tr_escrow_legacy_amount_fill ON public.escrow_transactions;
    DROP FUNCTION IF EXISTS public.tr_escrow_legacy_amount_fill();
  END IF;
END $$;

-- Skip financial audit row when amount is missing (should not happen after NOT NULL).
CREATE OR REPLACE FUNCTION public.tr_financial_log_escrow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.amount_cents IS NOT NULL AND NEW.amount_cents > 0 THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_created',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':created',
        jsonb_build_object('plan_id', NEW.plan_id)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'funded' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_funded',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':funded',
        jsonb_build_object('paystack_reference', NEW.paystack_reference)
      );
    ELSIF NEW.status = 'released' THEN
      PERFORM public.append_financial_event(
        NEW.payee_id,
        'escrow_released',
        COALESCE(NEW.amount_cents, 0) - COALESCE(NEW.platform_fee_cents, 0),
        'escrow:' || NEW.id::text || ':released',
        jsonb_build_object('fee', NEW.platform_fee_cents)
      );
    ELSIF NEW.status = 'disputed' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_disputed',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':disputed',
        '{}'::jsonb
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

NOTIFY pgrst, 'reload schema';
