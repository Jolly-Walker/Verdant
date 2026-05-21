ALTER TABLE sequence_plans
  ADD COLUMN IF NOT EXISTS position_size_usd numeric(18,2);
