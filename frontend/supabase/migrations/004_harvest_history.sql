-- Harvest history
CREATE TABLE harvest_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  protocol              TEXT NOT NULL,
  chain                 TEXT NOT NULL,
  reward_token          TEXT,
  reward_amount_usd     NUMERIC,
  tx_hash               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
