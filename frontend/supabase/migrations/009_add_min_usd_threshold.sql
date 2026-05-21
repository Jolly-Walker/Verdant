-- Add minimum USD threshold setting to user_settings
ALTER TABLE user_settings ADD COLUMN min_usd_threshold NUMERIC DEFAULT 1;

COMMENT ON COLUMN user_settings.min_usd_threshold IS 'Minimum USD value for positions to be displayed and for transactions to be executed.';
