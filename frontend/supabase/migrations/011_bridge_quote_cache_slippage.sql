-- 011_bridge_quote_cache_slippage.sql
-- Slippage affects the executable outputAmount derived from a cached quote, so it
-- must be part of the cache key — otherwise a quote cached at one slippage is
-- served to a request asking for a different slippage. Stored as TEXT (canonical
-- string) to key on exact equality without float-comparison pitfalls.
ALTER TABLE bridge_quotes_cache ADD COLUMN slippage_percent TEXT NOT NULL DEFAULT '0.5';

DROP INDEX IF EXISTS idx_bridge_quotes_cache_lookup;
CREATE INDEX idx_bridge_quotes_cache_lookup ON bridge_quotes_cache(from_chain, to_chain, token, amount_wei, recipient, slippage_percent);
