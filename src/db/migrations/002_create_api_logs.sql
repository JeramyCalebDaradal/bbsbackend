-- =============================================================================
-- Migration 002: Create bbs_api_logs table and bbs_api_logs_view
-- Run this script against your production MySQL database.
-- =============================================================================

CREATE TABLE IF NOT EXISTS bbs_api_logs (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  url                 VARCHAR(2048) NOT NULL,
  method              VARCHAR(10) NOT NULL,
  ip_address          VARCHAR(45) NOT NULL,
  status_code         INT UNSIGNED NOT NULL,
  user_id             BIGINT UNSIGNED NULL,
  authorization_masked VARCHAR(255) NULL,
  user_agent          VARCHAR(512) NULL,
  response_time_ms    INT UNSIGNED NULL,
  referer             VARCHAR(2048) NULL,
  time_sent           TIME NOT NULL,
  date_sent           DATE NOT NULL,
  PRIMARY KEY (id),
  KEY idx_api_logs_date_time (date_sent, time_sent),
  KEY idx_api_logs_user_id (user_id),
  KEY idx_api_logs_status (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Create / replace the view that joins with auth for user details
-- =============================================================================

CREATE OR REPLACE VIEW bbs_api_logs_view AS
SELECT
  l.id,
  l.url,
  l.method,
  l.ip_address,
  l.status_code,
  l.user_id,
  a.email AS user_email,
  CONCAT(a.first_name, ' ', a.last_name) AS user_full_name,
  l.authorization_masked,
  l.user_agent,
  l.response_time_ms,
  l.referer,
  l.time_sent,
  l.date_sent
FROM bbs_api_logs l
LEFT JOIN auth a ON a.id = l.user_id;

-- =============================================================================
-- Optional: Daily cleanup event to purge logs older than 90 days
-- Enable this if your MySQL instance supports events (EVENT scheduler ON).
-- =============================================================================
-- 
-- DELIMITER //
-- CREATE EVENT IF NOT EXISTS purge_api_logs
--   ON SCHEDULE EVERY 1 DAY
--   STARTS CURRENT_DATE + INTERVAL 1 DAY
--   DO
--     DELETE FROM bbs_api_logs WHERE date_sent < CURDATE() - INTERVAL 90 DAY;
-- //
-- DELIMITER ;

-- =============================================================================
-- Rollback (if needed):
--   DROP TABLE IF EXISTS bbs_api_logs;
--   DROP VIEW IF EXISTS bbs_api_logs_view;
-- =============================================================================