-- Fix stale escrow_transactions.status CHECK that blocks pending_funding inserts.
-- Does NOT alter column type (that fails when triggers reference status).

DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM (
    'pending_funding', 'funded', 'released', 'disputed', 'refunded', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.escrow_status ADD VALUE 'active';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Triggers: compare via ::text (works for TEXT or escrow_status columns).
CREATE OR REPLACE FUNCTION public.notify_escrow_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
  v_title TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text = 'funded' AND OLD.status::text = 'pending_funding' THEN
    RETURN NEW;
  END IF;

  v_plan := NEW.plan_id;
  SELECT title INTO v_title FROM public.plans WHERE id = v_plan;

  PERFORM public.create_notification(
    NEW.payer_id,
    'escrow_status',
    'Escrow update',
    CASE
      WHEN v_title IS NOT NULL THEN '“' || v_title || '”: status is now ' || NEW.status::text || '.'
      ELSE 'Your escrow status changed to ' || NEW.status::text || '.'
    END,
    jsonb_build_object(
      'escrowId', NEW.id::text,
      'planId', v_plan::text,
      'href', '/escrow/' || NEW.id::text,
      'status', NEW.status::text
    ),
    'high',
    'escrow:' || NEW.id::text || ':payer:' || NEW.status::text
  );

  PERFORM public.create_notification(
    NEW.payee_id,
    'escrow_status',
    'Escrow update',
    CASE
      WHEN v_title IS NOT NULL THEN '“' || v_title || '”: status is now ' || NEW.status::text || '.'
      ELSE 'Your escrow status changed to ' || NEW.status::text || '.'
    END,
    jsonb_build_object(
      'escrowId', NEW.id::text,
      'planId', v_plan::text,
      'href', '/escrow/' || NEW.id::text,
      'status', NEW.status::text
    ),
    'high',
    'escrow:' || NEW.id::text || ':payee:' || NEW.status::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escrow_notify_awaiting_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_title TEXT;
  v_plan_id UUID;
  v_href TEXT;
  v_body_pay TEXT;
  v_body_wait TEXT;
BEGIN
  IF NEW.status::text IS DISTINCT FROM 'pending_funding' THEN
    RETURN NEW;
  END IF;

  SELECT p.title, p.id INTO v_plan_title, v_plan_id
  FROM public.plans p
  WHERE p.id = NEW.plan_id;

  v_href := '/escrow/' || NEW.id::text;
  v_body_pay := 'Open secure payment to activate your meetup.';
  IF v_plan_title IS NOT NULL THEN
    v_body_pay := v_body_pay || ' Plan: "' || v_plan_title || '".';
  END IF;
  v_body_wait := 'The other person still needs to complete secure payment. You can track progress in escrow.';

  IF NEW.escrow_pattern = 'B' THEN
    IF NEW.host_id IS NOT NULL AND NEW.host_funded_at IS NULL THEN
      PERFORM public.create_notification(
        NEW.host_id,
        'payment_reminder',
        'Secure payment needed',
        v_body_pay,
        jsonb_build_object('planId', v_plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'due'),
        'high',
        'payment_due:' || NEW.id::text || ':' || NEW.host_id::text
      );
    END IF;
    IF NEW.guest_id IS NOT NULL AND NEW.guest_funded_at IS NULL THEN
      PERFORM public.create_notification(
        NEW.guest_id,
        'payment_reminder',
        'Secure payment needed',
        v_body_pay,
        jsonb_build_object('planId', v_plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'due'),
        'high',
        'payment_due:' || NEW.id::text || ':' || NEW.guest_id::text
      );
    END IF;
    IF NEW.host_id IS NOT NULL AND NEW.host_funded_at IS NOT NULL AND NEW.guest_funded_at IS NULL AND NEW.guest_id IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.host_id,
        'payment_reminder',
        'Waiting for guest payment',
        v_body_wait,
        jsonb_build_object('planId', v_plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'waiting'),
        'medium',
        'payment_waiting:' || NEW.id::text || ':' || NEW.host_id::text
      );
    END IF;
    IF NEW.guest_id IS NOT NULL AND NEW.guest_funded_at IS NOT NULL AND NEW.host_funded_at IS NULL AND NEW.host_id IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.guest_id,
        'payment_reminder',
        'Waiting for host payment',
        v_body_wait,
        jsonb_build_object('planId', v_plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'waiting'),
        'medium',
        'payment_waiting:' || NEW.id::text || ':' || NEW.guest_id::text
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.payer_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.payer_id,
      'payment_reminder',
      'Secure payment needed',
      v_body_pay,
      jsonb_build_object('planId', v_plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'due'),
      'high',
      'payment_due:' || NEW.id::text || ':' || NEW.payer_id::text
    );
  END IF;

  IF NEW.payee_id IS NOT NULL AND NEW.payee_id IS DISTINCT FROM NEW.payer_id THEN
    PERFORM public.create_notification(
      NEW.payee_id,
      'payment_reminder',
      'Waiting for secure payment',
      v_body_wait,
      jsonb_build_object('planId', v_plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'waiting'),
      'medium',
      'payment_waiting:' || NEW.id::text || ':' || NEW.payee_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_escrow_notify_split_leg_funded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_title TEXT;
  v_body TEXT;
  v_href TEXT;
BEGIN
  IF NEW.escrow_pattern IS DISTINCT FROM 'B' OR NEW.status::text IS DISTINCT FROM 'pending_funding' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_plan_title FROM public.plans WHERE id = NEW.plan_id;
  v_href := '/escrow/' || NEW.id::text;
  v_body := 'Your share is still due. Open escrow to complete checkout.';
  IF v_plan_title IS NOT NULL THEN
    v_body := v_body || ' Plan: "' || v_plan_title || '".';
  END IF;

  IF OLD.host_funded_at IS NULL AND NEW.host_funded_at IS NOT NULL AND NEW.guest_funded_at IS NULL AND NEW.guest_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.guest_id,
      'payment_reminder',
      'Your turn: fund your share',
      v_body,
      jsonb_build_object('planId', NEW.plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'split_other_paid'),
      'high',
      'payment_reminder:' || NEW.id::text || ':' || NEW.guest_id::text || ':split_other_paid'
    );
  END IF;

  IF OLD.guest_funded_at IS NULL AND NEW.guest_funded_at IS NOT NULL AND NEW.host_funded_at IS NULL AND NEW.host_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.host_id,
      'payment_reminder',
      'Your turn: fund your share',
      v_body,
      jsonb_build_object('planId', NEW.plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'split_other_paid'),
      'high',
      'payment_reminder:' || NEW.id::text || ':' || NEW.host_id::text || ':split_other_paid'
    );
  END IF;

  RETURN NEW;
END;
$$;

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
    IF NEW.status::text = 'funded' THEN
      PERFORM public.append_financial_event(
        NEW.payer_id,
        'escrow_funded',
        NEW.amount_cents,
        'escrow:' || NEW.id::text || ':funded',
        jsonb_build_object('paystack_reference', NEW.paystack_reference)
      );
    ELSIF NEW.status::text = 'released' THEN
      PERFORM public.append_financial_event(
        NEW.payee_id,
        'escrow_released',
        COALESCE(NEW.amount_cents, 0) - COALESCE(NEW.platform_fee_cents, 0),
        'escrow:' || NEW.id::text || ':released',
        jsonb_build_object('fee', NEW.platform_fee_cents)
      );
    ELSIF NEW.status::text = 'disputed' THEN
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

ALTER TABLE public.escrow_transactions DROP CONSTRAINT IF EXISTS escrow_transactions_status_check;

DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT c.udt_name INTO v_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'escrow_transactions'
    AND c.column_name = 'status';

  IF v_udt IN ('text', 'varchar', 'character varying') THEN
    ALTER TABLE public.escrow_transactions
      ALTER COLUMN status SET DEFAULT 'pending_funding';

    ALTER TABLE public.escrow_transactions
      ADD CONSTRAINT escrow_transactions_status_check
      CHECK (
        status IN (
          'pending_funding',
          'funded',
          'active',
          'released',
          'disputed',
          'refunded',
          'cancelled',
          'pending',
          'awaiting_payment',
          'awaiting_funding'
        )
      );
  ELSIF v_udt = 'escrow_status' THEN
    ALTER TABLE public.escrow_transactions
      ALTER COLUMN status SET DEFAULT 'pending_funding'::public.escrow_status;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
