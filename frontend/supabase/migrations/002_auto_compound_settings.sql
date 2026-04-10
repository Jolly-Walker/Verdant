-- Auto-compound preferences per position
CREATE TABLE auto_compound_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  protocol              TEXT NOT NULL,
  chain                 TEXT NOT NULL,
  asset                 TEXT NOT NULL,
  enabled               BOOLEAN DEFAULT FALSE,
  min_threshold_usd     NUMERIC DEFAULT 10,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (wallet_address, protocol, chain, asset)
);
