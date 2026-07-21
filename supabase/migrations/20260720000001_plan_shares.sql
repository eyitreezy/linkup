-- Track share events per plan per channel
CREATE TABLE IF NOT EXISTS plan_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  shared_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN (
    'whatsapp', 'copy_link', 'native', 'twitter', 'instagram'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_shares_plan_id
  ON plan_shares(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_shares_user_id
  ON plan_shares(shared_by_user_id);

ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_record_share"
  ON plan_shares FOR INSERT
  WITH CHECK (true);

CREATE POLICY "user_read_own_shares"
  ON plan_shares FOR SELECT
  USING (shared_by_user_id = auth.uid());

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_plan_share_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE plans SET share_count = share_count + 1
  WHERE id = NEW.plan_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_plan_share_count ON plan_shares;
CREATE TRIGGER trg_increment_plan_share_count
  AFTER INSERT ON plan_shares
  FOR EACH ROW EXECUTE FUNCTION increment_plan_share_count();
