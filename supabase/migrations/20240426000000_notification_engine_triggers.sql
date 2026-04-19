/**
 * Event → notification engine (in-app via create_notification).
 * Optional push: wire Database Webhook on public.notifications INSERT → Edge function push-on-notification.
 *
 * Escrow funded: handled only in paystack-webhook-escrow (avoid duplicate with legacy trigger).
 * Other escrow transitions: notify both parties via public.notifications.
 */

-- Legacy trigger wrote to app_notifications; migrate to public.notifications and skip funded transition.
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

  -- paystack-webhook-escrow owns pending_funding → funded (notifications + push there)
  IF NEW.status = 'funded'::public.escrow_status AND OLD.status = 'pending_funding'::public.escrow_status THEN
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

-- Offer accepted → notify bidder (host already knows)
CREATE OR REPLACE FUNCTION public.trg_plan_offers_notify_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_title TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'accepted'::public.offer_status THEN
    RETURN NEW;
  END IF;

  SELECT creator_id, title INTO v_creator, v_title FROM public.plans WHERE id = NEW.plan_id;
  IF v_creator IS NULL OR NEW.bidder_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.bidder_id,
    'mutual_agreement',
    'Offer accepted',
    CASE
      WHEN v_title IS NOT NULL THEN 'Your offer on “' || v_title || '” was accepted. Next: confirm details and escrow.'
      ELSE 'Your offer was accepted. Next: confirm details and escrow.'
    END,
    jsonb_build_object(
      'planId', NEW.plan_id::text,
      'offerId', NEW.id::text,
      'href', '/plan/' || NEW.plan_id::text || '/agreement'
    ),
    'medium',
    'offer_accepted:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_offers_notify_accepted ON public.plan_offers;
CREATE TRIGGER plan_offers_notify_accepted
  AFTER UPDATE OF status ON public.plan_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_plan_offers_notify_accepted();

-- New DM → notify peer (low priority; consider muting in UI)
CREATE OR REPLACE FUNCTION public.trg_messages_notify_peer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ua UUID;
  ub UUID;
  recipient UUID;
  preview TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT user_a, user_b INTO ua, ub FROM public.conversations WHERE id = NEW.conversation_id;
  IF ua IS NULL OR ub IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = ua THEN
    recipient := ub;
  ELSIF NEW.sender_id = ub THEN
    recipient := ua;
  ELSE
    RETURN NEW;
  END IF;

  preview := COALESCE(NULLIF(trim(NEW.body), ''), NULLIF(trim(NEW.text), ''), 'Sent a message');

  PERFORM public.create_notification(
    recipient,
    'message',
    'New message',
    left(preview, 160),
    jsonb_build_object(
      'chatId', NEW.conversation_id::text,
      'href', '/chat/' || NEW.conversation_id::text
    ),
    'low',
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify_peer ON public.messages;
CREATE TRIGGER messages_notify_peer
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_messages_notify_peer();

-- Dispute opened → notify counterparty
CREATE OR REPLACE FUNCTION public.trg_escrow_disputes_notify_counterparty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payer UUID;
  payee UUID;
  counterparty UUID;
  v_plan UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT payer_id, payee_id, plan_id INTO payer, payee, v_plan
  FROM public.escrow_transactions WHERE id = NEW.escrow_id;

  IF payer IS NULL OR payee IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.opened_by = payer THEN
    counterparty := payee;
  ELSE
    counterparty := payer;
  END IF;

  PERFORM public.create_notification(
    counterparty,
    'dispute_opened',
    'Dispute opened',
    'A dispute was opened on your escrow. Funds may be on hold while we review.',
    jsonb_build_object(
      'escrowId', NEW.escrow_id::text,
      'planId', COALESCE(v_plan::text, ''),
      'href', '/escrow/' || NEW.escrow_id::text,
      'disputeId', NEW.id::text
    ),
    'high',
    'dispute:' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS escrow_disputes_notify_counterparty ON public.escrow_disputes;
CREATE TRIGGER escrow_disputes_notify_counterparty
  AFTER INSERT ON public.escrow_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_escrow_disputes_notify_counterparty();

-- KYC decision → notify applicant
CREATE OR REPLACE FUNCTION public.trg_verification_request_notify_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'admin_approved'::public.verification_request_status THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'kyc_decision',
      'You’re verified',
      'Your identity check passed. You can create plans, negotiate, and use escrow.',
      jsonb_build_object('href', '/kyc'),
      'high',
      'kyc_decision:' || NEW.id::text || ':approved'
    );
  ELSIF NEW.status = 'admin_rejected'::public.verification_request_status THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'kyc_decision',
      'Verification needs another look',
      COALESCE(
        NULLIF(trim('We could not verify your documents. ' || COALESCE(NEW.rejection_reason, '')), ''),
        'We could not verify your documents. You can resubmit from Verification.'
      ),
      jsonb_build_object('href', '/kyc'),
      'high',
      'kyc_decision:' || NEW.id::text || ':rejected'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verification_request_notify_user ON public.verification_requests;
CREATE TRIGGER verification_request_notify_user
  AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_verification_request_notify_user();
