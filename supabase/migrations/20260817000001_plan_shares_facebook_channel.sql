-- Allow facebook as a plan share analytics channel.

ALTER TABLE public.plan_shares DROP CONSTRAINT IF EXISTS plan_shares_channel_check;

ALTER TABLE public.plan_shares ADD CONSTRAINT plan_shares_channel_check CHECK (
  channel IN ('whatsapp', 'copy_link', 'native', 'twitter', 'instagram', 'facebook')
);
