-- ============================================================
-- Migration: 003_create_bbs_users_and_role_config.sql
-- Creates bbs_users (Entra directory cache) and bbs_role_config (role-to-page access)
-- Run this on PRODUCTION database manually
-- ============================================================

-- 1) bbs_users: Entra directory cache (synced via Graph change notifications)
-- Composite PK on (tid, oid) to match Graph user id (tenant + object id)
CREATE TABLE IF NOT EXISTS `bbs_users` (
  `tid` CHAR(36) NOT NULL,
  `oid` CHAR(36) NOT NULL,
  `upn` VARCHAR(256) NOT NULL,
  `mail` VARCHAR(256) NULL,
  `display_name` VARCHAR(256) NOT NULL,
  `given_name` VARCHAR(128) NULL,
  `surname` VARCHAR(128) NULL,
  `account_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `user_type` VARCHAR(32) NOT NULL DEFAULT 'Member',
  `last_synced_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  `sync_hash` VARCHAR(64) NULL,
  PRIMARY KEY (`tid`, `oid`),
  KEY `idx_bbs_users_upn` (`upn`),
  KEY `idx_bbs_users_mail` (`mail`),
  KEY `idx_bbs_users_display_name` (`display_name`),
  KEY `idx_bbs_users_account_enabled` (`account_enabled`),
  KEY `idx_bbs_users_last_synced_at` (`last_synced_at`),
  KEY `idx_bbs_users_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) bbs_role_config: Website-managed role → page access mapping
-- One row per (tenant, role_name). Admin editable via dashboard UI.
CREATE TABLE IF NOT EXISTS `bbs_role_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tid` CHAR(36) NOT NULL,
  `role_name` VARCHAR(64) NOT NULL,
  `allowed_pages_json` JSON NOT NULL,
  `description` VARCHAR(255) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by_user_id` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bbs_role_config_tid_role` (`tid`, `role_name`),
  KEY `idx_bbs_role_config_tid` (`tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Seed default role configs (replace TENANT_ID placeholder with your actual Entra Tenant ID)
-- Example: 'ec2873dc-1398-4b13-bf02-9b5989ea918c' (your actual tenant ID from Entra)
-- Run this separately after table creation, or replace the placeholder below:
INSERT INTO `bbs_role_config` (`tid`, `role_name`, `allowed_pages_json`, `description`)
VALUES 
  ('REPLACE_WITH_YOUR_TENANT_ID', 'Default', '[]', 'Default role - no dashboard access'),
  ('REPLACE_WITH_YOUR_TENANT_ID', 'Administrator', '["dashboard", "users", "roles", "settings", "reports", "articles", "events", "appointments", "leads", "datasheets", "videos", "logs", "api-logs"]', 'Full admin access'),
  ('REPLACE_WITH_YOUR_TENANT_ID', 'ContentManager', '["dashboard", "articles", "events", "videos", "datasheets"]', 'Content management access'),
  ('REPLACE_WITH_YOUR_TENANT_ID', 'Analyst', '["dashboard", "reports", "users", "leads"]', 'Analytics and reporting access')
ON DUPLICATE KEY UPDATE `role_name` = `role_name`;

-- ============================================================
-- Usage notes:
-- - Replace 'REPLACE_WITH_YOUR_TENANT_ID' with your actual Entra tenant ID (e.g., 'ec2873dc-1398-4b13-bf02-9b5989ea918c')
-- - Role names MUST match Entra App Role names exactly (case-sensitive): 'Administrator', 'ContentManager', 'Analyzer'
-- - 'Default' role is assigned when user has no Entra app roles
-- - Admin UI will read/write allowed_pages_json for each role
-- ============================================================