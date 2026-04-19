-- Realtime for Offers and Saved tabs (client subscriptions).
-- If a table is already in `supabase_realtime`, this migration may error on re-run; safe to ignore duplicate.

ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_engagements;
