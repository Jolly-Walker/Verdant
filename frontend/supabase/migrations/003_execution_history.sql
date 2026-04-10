-- Transaction history for user reference
CREATE TABLE execution_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  tx_hash_step1         TEXT,
  tx_hash_step2         TEXT,
  source_protocol       TEXT,
  source_chain          TEXT,
  dest_protocol         TEXT,
  dest_chain            TEXT,
  asset                 TEXT,
  amount_usd            NUMERIC,
  bridge_fee_usd        NUMERIC,
  slippage_usd          NUMERIC,
  gas_usd               NUMERIC,
  status                TEXT DEFAULT 'pending',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);
