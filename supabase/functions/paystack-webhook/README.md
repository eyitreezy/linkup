# Paystack webhook (Edge Function)

Deploy a Supabase Edge Function that:

1. Verifies `x-paystack-signature` using `PAYSTACK_SECRET_KEY`.
2. On `charge.success`, updates `escrow_transactions`:
   - Set `status` to `funded`.
   - Set `paystack_reference` from the event payload.
   - Merge into `metadata`: `charge_confirmed_at` (ISO timestamp), and any Paystack `reference` / `customer` fields you need for audit.
3. Set the related plan to **active** so the meetup flow can continue:
   - `UPDATE public.plans SET status = 'active' WHERE id = <plan_id> AND status IN ('awaiting_payment', 'agreed');`
   - Resolve `plan_id` from `metadata.plan_id` / `metadata.escrow_id` on the transaction row.
4. Never expose `PAYSTACK_SECRET_KEY` in the Expo app — only here or on your backend.

The mobile app records `payment_initiated_at` and `checkout_reference` in `escrow_transactions.metadata` when the user opens checkout; the webhook should add `charge_confirmed_at` when payment succeeds.

Reference: [Paystack webhooks](https://paystack.com/docs/payments/webhooks/).
