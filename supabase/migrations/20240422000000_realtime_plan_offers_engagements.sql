-- Realtime for Offers and Saved tabs (client subscriptions).

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_offers;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_engagements;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;
