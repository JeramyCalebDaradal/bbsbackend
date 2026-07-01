-- =============================================================================
-- Migration 001: Create refresh_tokens table for token rotation system
-- Run this script against your production MySQL database.
-- =============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  token_hash      CHAR(60) NOT NULL,                -- bcrypt(refresh_token, 12)
  family_id       CHAR(36) NOT NULL,                -- UUID v4, groups rotation chain
  revoked         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME NOT NULL,

  INDEX idx_family_revoked (family_id, revoked),
  INDEX idx_user_revoked (user_id, revoked),
  INDEX idx_expires (expires_at),

  FOREIGN KEY (user_id) REFERENCES auth(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Optional: Daily cleanup event to purge expired rows older than 7 days
-- Enable this if your MySQL instance supports events (EVENT scheduler ON).
-- =============================================================================
-- 
-- DELIMITER //
-- CREATE EVENT IF NOT EXISTS purge_expired_refresh_tokens
--   ON SCHEDULE EVERY 1 DAY
--   STARTS CURRENT_DATE + INTERVAL 1 DAY
--   DO
--     DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL 7 DAY;
-- //
-- DELIMITER ;

-- =============================================================================
-- Rollback (if needed):
--   DROP TABLE IF EXISTS refresh_tokens;
-- =============================================================================