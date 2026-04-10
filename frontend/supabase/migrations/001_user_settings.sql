-- User preferences and settings
CREATE TABLE user_settings (
  wallet_address  TEXT PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
