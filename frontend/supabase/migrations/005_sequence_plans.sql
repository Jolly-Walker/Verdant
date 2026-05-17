CREATE TABLE sequence_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address    TEXT NOT NULL,
  template_id       TEXT NOT NULL,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  total_cost_usd    NUMERIC,
  steps             JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_sequence_plans_wallet ON sequence_plans(wallet_address);
CREATE INDEX idx_sequence_plans_status ON sequence_plans(status);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sequence_plans_updated_at
  BEFORE UPDATE ON sequence_plans
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
