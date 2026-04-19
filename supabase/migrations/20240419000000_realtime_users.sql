-- Broadcast own-row updates (e.g. verification_status from admin / triggers) to clients.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%already member%' OR SQLERRM LIKE '%duplicate key%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;
