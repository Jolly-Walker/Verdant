-- Add token address and improve indexing on harvest_history
ALTER TABLE harvest_history
  ADD COLUMN IF NOT EXISTS reward_token_address TEXT;

-- Index for wallet + protocol lookups in the harvest dashboard
CREATE INDEX IF NOT EXISTS harvest_history_wallet_protocol_idx
  ON harvest_history (wallet_address, protocol, created_at DESC);
