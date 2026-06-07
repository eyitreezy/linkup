-- Automated payment reminders for plans in awaiting_payment + escrow pending_funding.
-- Inserts into public.notifications → Database Webhooks → push-on-notification + notification-email.

-- ---------------------------------------------------------------------------
-- Immediate: when escrow row is created (plan → awaiting_payment)
-- ---------------------------------------------------------------------------
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
  IF NEW.status IS DISTINCT FROM 'pending_funding'::public.escrow_status THEN
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

  -- Pattern B: each unfunded leg
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
    -- Waiting notice for funded leg (one-time)
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

  -- Pattern A / C: single payer
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

DROP TRIGGER IF EXISTS escrow_notify_awaiting_payment ON public.escrow_transactions;
CREATE TRIGGER escrow_notify_awaiting_payment
  AFTER INSERT ON public.escrow_transactions
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_escrow_notify_awaiting_payment();

-- When one split leg funds, remind the other party to pay their share.
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
  IF NEW.escrow_pattern IS DISTINCT FROM 'B' OR NEW.status IS DISTINCT FROM 'pending_funding'::public.escrow_status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_plan_title FROM public.plans WHERE id = NEW.plan_id;
  v_href := '/escrow/' || NEW.id::text;
  v_body := 'Your share is still due — open escrow to complete Paystack checkout.';
  IF v_plan_title IS NOT NULL THEN
    v_body := v_body || ' Plan: "' || v_plan_title || '".';
  END IF;

  IF OLD.host_funded_at IS NULL AND NEW.host_funded_at IS NOT NULL AND NEW.guest_funded_at IS NULL AND NEW.guest_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.guest_id,
      'payment_reminder',
      'Your turn — fund your share',
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
      'Your turn — fund your share',
      v_body,
      jsonb_build_object('planId', NEW.plan_id::text, 'escrowId', NEW.id::text, 'href', v_href, 'phase', 'split_other_paid'),
      'high',
      'payment_reminder:' || NEW.id::text || ':' || NEW.host_id::text || ':split_other_paid'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_notify_split_leg_funded ON public.escrow_transactions;
CREATE TRIGGER escrow_notify_split_leg_funded
  AFTER UPDATE OF host_funded_at, guest_funded_at ON public.escrow_transactions
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_escrow_notify_split_leg_funded();

-- ---------------------------------------------------------------------------
-- Scheduled sweep (call from Edge Function payment-reminder-sweep on a cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._payment_reminder_for_user(
  p_user_id UUID,
  p_escrow_id UUID,
  p_plan_id UUID,
  p_plan_title TEXT,
  p_phase TEXT,
  p_title TEXT,
  p_body TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(
    p_user_id,
    'payment_reminder',
    p_title,
    p_body,
    jsonb_build_object(
      'planId', p_plan_id::text,
      'escrowId', p_escrow_id::text,
      'href', '/escrow/' || p_escrow_id::text,
      'phase', p_phase
    ),
    'high',
    'payment_reminder:' || p_escrow_id::text || ':' || p_user_id::text || ':' || p_phase
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sweep_awaiting_payment_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_now TIMESTAMPTZ := now();
  v_meetup TIMESTAMPTZ;
  v_body TEXT;
  v_title TEXT;
  v_sent INTEGER := 0;
  v_needs_host BOOLEAN;
  v_needs_guest BOOLEAN;
BEGIN
  FOR r IN
    SELECT
      p.id AS plan_id,
      p.title AS plan_title,
      p.agreed_scheduled_at,
      p.scheduled_at,
      e.id AS escrow_id,
      e.payer_id,
      e.payee_id,
      e.host_id,
      e.guest_id,
      e.escrow_pattern,
      e.host_funded_at,
      e.guest_funded_at,
      e.funding_deadline,
      e.created_at AS escrow_created_at
    FROM public.plans p
    INNER JOIN public.escrow_transactions e ON e.plan_id = p.id
    WHERE p.status = 'awaiting_payment'
      AND e.status = 'pending_funding'
  LOOP
    v_meetup := COALESCE(r.agreed_scheduled_at, r.scheduled_at);
    v_body := 'Complete secure payment in escrow before your meetup.';
    IF r.plan_title IS NOT NULL THEN
      v_body := v_body || ' Plan: "' || r.plan_title || '".';
    END IF;

    v_needs_host := r.escrow_pattern = 'B' AND r.host_id IS NOT NULL AND r.host_funded_at IS NULL;
    v_needs_guest := r.escrow_pattern = 'B' AND r.guest_id IS NOT NULL AND r.guest_funded_at IS NULL;

    -- Meetup within 24h
    IF v_meetup IS NOT NULL AND v_meetup > v_now AND v_meetup <= v_now + interval '24 hours' THEN
      v_title := 'Meetup soon — fund escrow';
      IF v_needs_host THEN
        PERFORM public._payment_reminder_for_user(r.host_id, r.escrow_id, r.plan_id, r.plan_title, 'meetup_24h', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
      IF v_needs_guest THEN
        PERFORM public._payment_reminder_for_user(r.guest_id, r.escrow_id, r.plan_id, r.plan_title, 'meetup_24h', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
      IF NOT v_needs_host AND NOT v_needs_guest AND r.payer_id IS NOT NULL THEN
        PERFORM public._payment_reminder_for_user(r.payer_id, r.escrow_id, r.plan_id, r.plan_title, 'meetup_24h', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
    ELSIF v_meetup IS NOT NULL AND v_meetup > v_now AND v_meetup <= v_now + interval '48 hours' THEN
      v_title := 'Meetup coming up — fund escrow';
      IF v_needs_host THEN
        PERFORM public._payment_reminder_for_user(r.host_id, r.escrow_id, r.plan_id, r.plan_title, 'meetup_48h', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
      IF v_needs_guest THEN
        PERFORM public._payment_reminder_for_user(r.guest_id, r.escrow_id, r.plan_id, r.plan_title, 'meetup_48h', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
      IF NOT v_needs_host AND NOT v_needs_guest AND r.payer_id IS NOT NULL THEN
        PERFORM public._payment_reminder_for_user(r.payer_id, r.escrow_id, r.plan_id, r.plan_title, 'meetup_48h', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
    END IF;

    -- Funding deadline windows
    IF r.funding_deadline IS NOT NULL AND r.funding_deadline > v_now THEN
      IF r.funding_deadline <= v_now + interval '2 hours' THEN
        v_title := 'Fund escrow soon — deadline in 2 hours';
        IF v_needs_host THEN
          PERFORM public._payment_reminder_for_user(r.host_id, r.escrow_id, r.plan_id, r.plan_title, 'deadline_2h', v_title, v_body);
          v_sent := v_sent + 1;
        END IF;
        IF v_needs_guest THEN
          PERFORM public._payment_reminder_for_user(r.guest_id, r.escrow_id, r.plan_id, r.plan_title, 'deadline_2h', v_title, v_body);
          v_sent := v_sent + 1;
        END IF;
        IF NOT v_needs_host AND NOT v_needs_guest AND r.payer_id IS NOT NULL THEN
          PERFORM public._payment_reminder_for_user(r.payer_id, r.escrow_id, r.plan_id, r.plan_title, 'deadline_2h', v_title, v_body);
          v_sent := v_sent + 1;
        END IF;
      ELSIF r.funding_deadline <= v_now + interval '12 hours' THEN
        v_title := 'Reminder — fund escrow';
        IF v_needs_host THEN
          PERFORM public._payment_reminder_for_user(r.host_id, r.escrow_id, r.plan_id, r.plan_title, 'deadline_12h', v_title, v_body);
          v_sent := v_sent + 1;
        END IF;
        IF v_needs_guest THEN
          PERFORM public._payment_reminder_for_user(r.guest_id, r.escrow_id, r.plan_id, r.plan_title, 'deadline_12h', v_title, v_body);
          v_sent := v_sent + 1;
        END IF;
        IF NOT v_needs_host AND NOT v_needs_guest AND r.payer_id IS NOT NULL THEN
          PERFORM public._payment_reminder_for_user(r.payer_id, r.escrow_id, r.plan_id, r.plan_title, 'deadline_12h', v_title, v_body);
          v_sent := v_sent + 1;
        END IF;
      END IF;
    END IF;

    -- Nudge 30+ minutes after escrow created (dedupe once per user/phase)
    IF r.escrow_created_at < v_now - interval '30 minutes' THEN
      v_title := 'Reminder — secure payment pending';
      IF v_needs_host THEN
        PERFORM public._payment_reminder_for_user(r.host_id, r.escrow_id, r.plan_id, r.plan_title, 'nudge', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
      IF v_needs_guest THEN
        PERFORM public._payment_reminder_for_user(r.guest_id, r.escrow_id, r.plan_id, r.plan_title, 'nudge', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
      IF NOT v_needs_host AND NOT v_needs_guest AND r.payer_id IS NOT NULL THEN
        PERFORM public._payment_reminder_for_user(r.payer_id, r.escrow_id, r.plan_id, r.plan_title, 'nudge', v_title, v_body);
        v_sent := v_sent + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public._payment_reminder_for_user(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_awaiting_payment_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_awaiting_payment_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_awaiting_payment_reminders() TO postgres;
