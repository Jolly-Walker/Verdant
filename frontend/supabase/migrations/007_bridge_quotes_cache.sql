-- 007_bridge_quotes_cache.sql
CREATE TABLE bridge_quotes_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_chain          TEXT NOT NULL,
  to_chain            TEXT NOT NULL,
  token               TEXT NOT NULL,
  amount_wei          TEXT NOT NULL,
  recipient           TEXT NOT NULL,
  quotes              JSONB NOT NULL,       -- BridgeQuote[]
  fetched_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_bridge_quotes_cache_lookup ON bridge_quotes_cache(from_chain, to_chain, token, amount_wei, recipient);
