-- Track pending Flutterwave subscription checkouts for fulfillment fallback.

ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_event_type_check
  CHECK (event_type IN (
    'trial_started',
    'trial_expired',
    'trial_expiring_notified',
    'checkout_started',
    'subscription_created',
    'subscription_renewed',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'subscription_expired',
    'payment_failed',
    'payment_succeeded',
    'admin_trial_grant',
    'admin_trial_extend',
    'admin_trial_revoke'
  ));

CREATE INDEX IF NOT EXISTS idx_subscription_events_flw_ref
  ON public.subscription_events (flutterwave_reference, event_type, created_at DESC);
