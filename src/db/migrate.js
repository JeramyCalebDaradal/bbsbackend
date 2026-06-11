const dotenv = require("dotenv");

dotenv.config();

const { pool } = require("./pool");

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function constraintExists(constraintName) {
  const [rows] = await pool.query(
    `
      SELECT 1 AS ok
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = ?
      LIMIT 1
    `,
    [constraintName]
  );
  return rows.length > 0;
}

async function migrateAuth() {
  const exists = await tableExists("auth");

  if (!exists) {
    await pool.query(`
      CREATE TABLE auth (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        dateAdded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expiry_date DATETIME NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        PRIMARY KEY (id),
        UNIQUE KEY uq_auth_email (email),
        KEY idx_auth_role (role),
        KEY idx_auth_status (status),
        KEY idx_auth_expiry_date (expiry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  if (await columnExists("auth", "date_added")) {
    if (!(await columnExists("auth", "dateAdded"))) {
      await pool.query(
        "ALTER TABLE auth CHANGE COLUMN date_added dateAdded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
      );
    }
  }

  if (!(await columnExists("auth", "first_name"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN first_name VARCHAR(100) NOT NULL");
  }
  if (!(await columnExists("auth", "last_name"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN last_name VARCHAR(100) NOT NULL");
  }
  if (!(await columnExists("auth", "email"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN email VARCHAR(255) NOT NULL");
  }
  if (!(await columnExists("auth", "password"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN password VARCHAR(255) NOT NULL");
  }
  if (!(await columnExists("auth", "dateAdded")) && !(await columnExists("auth", "date_added"))) {
    await pool.query(
      "ALTER TABLE auth ADD COLUMN dateAdded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    );
  }
  if (!(await columnExists("auth", "expiry_date"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN expiry_date DATETIME NULL");
  }
  if (!(await columnExists("auth", "role"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'");
  }
  if (!(await columnExists("auth", "status"))) {
    await pool.query("ALTER TABLE auth ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'");
  }

  if (!(await indexExists("auth", "uq_auth_email"))) {
    await pool.query("ALTER TABLE auth ADD UNIQUE KEY uq_auth_email (email)");
  }
  if (!(await indexExists("auth", "idx_auth_role"))) {
    await pool.query("ALTER TABLE auth ADD KEY idx_auth_role (role)");
  }
  if (!(await indexExists("auth", "idx_auth_status"))) {
    await pool.query("ALTER TABLE auth ADD KEY idx_auth_status (status)");
  }
  if (!(await indexExists("auth", "idx_auth_expiry_date"))) {
    await pool.query("ALTER TABLE auth ADD KEY idx_auth_expiry_date (expiry_date)");
  }
}

async function migrateEvents() {
  const exists = await tableExists("bbs_events");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        preview_image VARCHAR(1024) NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        location_type ENUM('online', 'in person') NOT NULL,
        location_address VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        capacity INT UNSIGNED NOT NULL,
        paid_event TINYINT(1) NOT NULL DEFAULT 0,
        tags JSON NOT NULL,
        date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by BIGINT UNSIGNED NOT NULL,
        added_by BIGINT UNSIGNED NULL,
        PRIMARY KEY (id),
        KEY idx_bbs_events_date_created (date_created),
        KEY idx_bbs_events_created_by (created_by),
        KEY idx_bbs_events_added_by (added_by),
        KEY idx_bbs_events_date (date),
        CONSTRAINT fk_bbs_events_created_by FOREIGN KEY (created_by) REFERENCES auth(id),
        CONSTRAINT fk_bbs_events_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["title", "ALTER TABLE bbs_events ADD COLUMN title VARCHAR(255) NOT NULL"],
    ["preview_image", "ALTER TABLE bbs_events ADD COLUMN preview_image VARCHAR(1024) NULL"],
    ["date", "ALTER TABLE bbs_events ADD COLUMN date DATE NOT NULL"],
    ["time", "ALTER TABLE bbs_events ADD COLUMN time TIME NOT NULL"],
    [
      "location_type",
      "ALTER TABLE bbs_events ADD COLUMN location_type ENUM('online', 'in person') NOT NULL",
    ],
    ["location_address", "ALTER TABLE bbs_events ADD COLUMN location_address VARCHAR(255) NOT NULL"],
    ["description", "ALTER TABLE bbs_events ADD COLUMN description TEXT NOT NULL"],
    ["category", "ALTER TABLE bbs_events ADD COLUMN category VARCHAR(100) NOT NULL"],
    ["capacity", "ALTER TABLE bbs_events ADD COLUMN capacity INT UNSIGNED NOT NULL"],
    ["paid_event", "ALTER TABLE bbs_events ADD COLUMN paid_event TINYINT(1) NOT NULL DEFAULT 0"],
    ["tags", "ALTER TABLE bbs_events ADD COLUMN tags JSON NOT NULL"],
    ["date_created", "ALTER TABLE bbs_events ADD COLUMN date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ["created_by", "ALTER TABLE bbs_events ADD COLUMN created_by BIGINT UNSIGNED NOT NULL"],
    ["added_by", "ALTER TABLE bbs_events ADD COLUMN added_by BIGINT UNSIGNED NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_events", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_events", "idx_bbs_events_date_created"))) {
    await pool.query("ALTER TABLE bbs_events ADD KEY idx_bbs_events_date_created (date_created)");
  }
  if (!(await indexExists("bbs_events", "idx_bbs_events_created_by"))) {
    await pool.query("ALTER TABLE bbs_events ADD KEY idx_bbs_events_created_by (created_by)");
  }
  if (!(await indexExists("bbs_events", "idx_bbs_events_added_by"))) {
    await pool.query("ALTER TABLE bbs_events ADD KEY idx_bbs_events_added_by (added_by)");
  }
  if (!(await indexExists("bbs_events", "idx_bbs_events_date"))) {
    await pool.query("ALTER TABLE bbs_events ADD KEY idx_bbs_events_date (date)");
  }

  if (await columnExists("bbs_events", "added_by")) {
    await pool.query("UPDATE bbs_events SET added_by = created_by WHERE added_by IS NULL");
  }

  if (!(await constraintExists("fk_bbs_events_added_by"))) {
    await pool.query(
      "ALTER TABLE bbs_events ADD CONSTRAINT fk_bbs_events_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL"
    );
  }
}

async function migrateEventAttendees() {
  const exists = await tableExists("bbs_events_attendees");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_events_attendees (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id BIGINT UNSIGNED NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        date_registered DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_bbs_events_attendees_email (email),
        UNIQUE KEY uq_bbs_events_attendees_contact_number (contact_number),
        KEY idx_bbs_events_attendees_event_id (event_id),
        CONSTRAINT fk_bbs_events_attendees_event_id FOREIGN KEY (event_id) REFERENCES bbs_events(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["event_id", "ALTER TABLE bbs_events_attendees ADD COLUMN event_id BIGINT UNSIGNED NOT NULL"],
    ["first_name", "ALTER TABLE bbs_events_attendees ADD COLUMN first_name VARCHAR(100) NOT NULL"],
    ["last_name", "ALTER TABLE bbs_events_attendees ADD COLUMN last_name VARCHAR(100) NOT NULL"],
    ["email", "ALTER TABLE bbs_events_attendees ADD COLUMN email VARCHAR(255) NOT NULL"],
    ["contact_number", "ALTER TABLE bbs_events_attendees ADD COLUMN contact_number VARCHAR(50) NOT NULL"],
    ["date_registered", "ALTER TABLE bbs_events_attendees ADD COLUMN date_registered DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_events_attendees", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_events_attendees", "uq_bbs_events_attendees_email"))) {
    await pool.query("ALTER TABLE bbs_events_attendees ADD UNIQUE KEY uq_bbs_events_attendees_email (email)");
  }
  if (!(await indexExists("bbs_events_attendees", "uq_bbs_events_attendees_contact_number"))) {
    await pool.query("ALTER TABLE bbs_events_attendees ADD UNIQUE KEY uq_bbs_events_attendees_contact_number (contact_number)");
  }
  if (!(await indexExists("bbs_events_attendees", "idx_bbs_events_attendees_event_id"))) {
    await pool.query("ALTER TABLE bbs_events_attendees ADD KEY idx_bbs_events_attendees_event_id (event_id)");
  }
}

async function migrateArticles() {
  const exists = await tableExists("bbs_articles");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_articles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        url_slug VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        tags JSON NOT NULL,
        featured_image VARCHAR(1024) NOT NULL,
        content LONGTEXT NOT NULL,
        article_status VARCHAR(30) NOT NULL,
        publish_date DATE NULL,
        added_by BIGINT UNSIGNED NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_bbs_articles_url_slug (url_slug),
        KEY idx_bbs_articles_status (article_status),
        KEY idx_bbs_articles_publish_date (publish_date),
        KEY idx_bbs_articles_added_by (added_by),
        CONSTRAINT fk_bbs_articles_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["title", "ALTER TABLE bbs_articles ADD COLUMN title VARCHAR(255) NOT NULL"],
    ["url_slug", "ALTER TABLE bbs_articles ADD COLUMN url_slug VARCHAR(255) NOT NULL"],
    ["category", "ALTER TABLE bbs_articles ADD COLUMN category VARCHAR(100) NOT NULL"],
    ["tags", "ALTER TABLE bbs_articles ADD COLUMN tags JSON NOT NULL"],
    ["featured_image", "ALTER TABLE bbs_articles ADD COLUMN featured_image VARCHAR(1024) NOT NULL"],
    ["content", "ALTER TABLE bbs_articles ADD COLUMN content LONGTEXT NOT NULL"],
    ["article_status", "ALTER TABLE bbs_articles ADD COLUMN article_status VARCHAR(30) NOT NULL"],
    ["publish_date", "ALTER TABLE bbs_articles ADD COLUMN publish_date DATE NULL"],
    ["added_by", "ALTER TABLE bbs_articles ADD COLUMN added_by BIGINT UNSIGNED NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_articles", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_articles", "uq_bbs_articles_url_slug"))) {
    await pool.query("ALTER TABLE bbs_articles ADD UNIQUE KEY uq_bbs_articles_url_slug (url_slug)");
  }
  if (!(await indexExists("bbs_articles", "idx_bbs_articles_status"))) {
    await pool.query("ALTER TABLE bbs_articles ADD KEY idx_bbs_articles_status (article_status)");
  }
  if (!(await indexExists("bbs_articles", "idx_bbs_articles_publish_date"))) {
    await pool.query("ALTER TABLE bbs_articles ADD KEY idx_bbs_articles_publish_date (publish_date)");
  }
  if (!(await indexExists("bbs_articles", "idx_bbs_articles_added_by"))) {
    await pool.query("ALTER TABLE bbs_articles ADD KEY idx_bbs_articles_added_by (added_by)");
  }

  if (!(await constraintExists("fk_bbs_articles_added_by"))) {
    await pool.query(
      "ALTER TABLE bbs_articles ADD CONSTRAINT fk_bbs_articles_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL"
    );
  }
}

async function migrateAppointments() {
  const exists = await tableExists("bbs_appointments");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_appointments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        service VARCHAR(150) NOT NULL,
        date_set DATE NOT NULL,
        time_set TIME NOT NULL,
        status VARCHAR(30) NOT NULL,
        location VARCHAR(255) NOT NULL,
        duration INT UNSIGNED NOT NULL DEFAULT 0,
        notes LONGTEXT NULL,
        date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        added_by BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_bbs_appointments_date_created (date_created),
        KEY idx_bbs_appointments_status (status),
        KEY idx_bbs_appointments_date_set (date_set),
        KEY idx_bbs_appointments_added_by (added_by),
        CONSTRAINT fk_bbs_appointments_added_by FOREIGN KEY (added_by) REFERENCES auth(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["full_name", "ALTER TABLE bbs_appointments ADD COLUMN full_name VARCHAR(255) NOT NULL"],
    ["email", "ALTER TABLE bbs_appointments ADD COLUMN email VARCHAR(255) NOT NULL"],
    ["contact_number", "ALTER TABLE bbs_appointments ADD COLUMN contact_number VARCHAR(50) NOT NULL"],
    ["service", "ALTER TABLE bbs_appointments ADD COLUMN service VARCHAR(150) NOT NULL"],
    ["date_set", "ALTER TABLE bbs_appointments ADD COLUMN date_set DATE NOT NULL"],
    ["time_set", "ALTER TABLE bbs_appointments ADD COLUMN time_set TIME NOT NULL"],
    ["status", "ALTER TABLE bbs_appointments ADD COLUMN status VARCHAR(30) NOT NULL"],
    ["location", "ALTER TABLE bbs_appointments ADD COLUMN location VARCHAR(255) NOT NULL"],
    ["duration", "ALTER TABLE bbs_appointments ADD COLUMN duration INT UNSIGNED NOT NULL DEFAULT 0"],
    ["notes", "ALTER TABLE bbs_appointments ADD COLUMN notes LONGTEXT NULL"],
    [
      "date_created",
      "ALTER TABLE bbs_appointments ADD COLUMN date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ],
    ["added_by", "ALTER TABLE bbs_appointments ADD COLUMN added_by BIGINT UNSIGNED NOT NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_appointments", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_appointments", "idx_bbs_appointments_date_created"))) {
    await pool.query("ALTER TABLE bbs_appointments ADD KEY idx_bbs_appointments_date_created (date_created)");
  }
  if (!(await indexExists("bbs_appointments", "idx_bbs_appointments_status"))) {
    await pool.query("ALTER TABLE bbs_appointments ADD KEY idx_bbs_appointments_status (status)");
  }
  if (!(await indexExists("bbs_appointments", "idx_bbs_appointments_date_set"))) {
    await pool.query("ALTER TABLE bbs_appointments ADD KEY idx_bbs_appointments_date_set (date_set)");
  }
  if (!(await indexExists("bbs_appointments", "idx_bbs_appointments_added_by"))) {
    await pool.query("ALTER TABLE bbs_appointments ADD KEY idx_bbs_appointments_added_by (added_by)");
  }
}

async function migrateLeads() {
  const exists = await tableExists("bbs_leads");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_leads (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        contact VARCHAR(50) NOT NULL,
        source VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'new',
        follow_up DATE NULL,
        notes LONGTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        added_by BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        KEY idx_bbs_leads_created_at (created_at),
        KEY idx_bbs_leads_status (status),
        KEY idx_bbs_leads_added_by (added_by),
        CONSTRAINT fk_bbs_leads_added_by FOREIGN KEY (added_by) REFERENCES auth(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["full_name", "ALTER TABLE bbs_leads ADD COLUMN full_name VARCHAR(255) NOT NULL"],
    ["email", "ALTER TABLE bbs_leads ADD COLUMN email VARCHAR(255) NOT NULL"],
    ["contact", "ALTER TABLE bbs_leads ADD COLUMN contact VARCHAR(50) NOT NULL"],
    ["source", "ALTER TABLE bbs_leads ADD COLUMN source VARCHAR(100) NOT NULL"],
    ["status", "ALTER TABLE bbs_leads ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'new'"],
    ["follow_up", "ALTER TABLE bbs_leads ADD COLUMN follow_up DATE NULL"],
    ["notes", "ALTER TABLE bbs_leads ADD COLUMN notes LONGTEXT NULL"],
    ["created_at", "ALTER TABLE bbs_leads ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ["added_by", "ALTER TABLE bbs_leads ADD COLUMN added_by BIGINT UNSIGNED NOT NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_leads", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_leads", "idx_bbs_leads_created_at"))) {
    await pool.query("ALTER TABLE bbs_leads ADD KEY idx_bbs_leads_created_at (created_at)");
  }
  if (!(await indexExists("bbs_leads", "idx_bbs_leads_status"))) {
    await pool.query("ALTER TABLE bbs_leads ADD KEY idx_bbs_leads_status (status)");
  }
  if (!(await indexExists("bbs_leads", "idx_bbs_leads_added_by"))) {
    await pool.query("ALTER TABLE bbs_leads ADD KEY idx_bbs_leads_added_by (added_by)");
  }
}

async function migrateReportsView() {
  await pool.query(`
    CREATE OR REPLACE VIEW bbs_reports_view AS
    SELECT
      CONVERT('kpi' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT('completion_rate' USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS key2,
      IFNULL(ROUND(100 * SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)), 0) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_appointments
    UNION ALL
    SELECT
      CONVERT('kpi' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT('lead_conversion_rate' USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS key2,
      IFNULL(ROUND(100 * SUM(CASE WHEN LOWER(status) = 'converted' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)), 0) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_leads
    UNION ALL
    SELECT
      CONVERT('kpi' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT('event_registrations_total' USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS key2,
      COUNT(*) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_events_attendees
    UNION ALL
    SELECT
      CONVERT('kpi' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT('published_articles_total' USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS key2,
      SUM(CASE WHEN LOWER(article_status) = 'published' THEN 1 ELSE 0 END) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_articles
    UNION ALL
    SELECT
      CONVERT('appointments_monthly' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT(DATE_FORMAT(date_created, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CONVERT(LOWER(status) USING utf8mb4) COLLATE utf8mb4_general_ci AS key2,
      COUNT(*) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_appointments
    WHERE date_created >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
    GROUP BY
      CONVERT(DATE_FORMAT(date_created, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci,
      CONVERT(LOWER(status) USING utf8mb4) COLLATE utf8mb4_general_ci
    UNION ALL
    SELECT
      CONVERT('leads_monthly' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT(DATE_FORMAT(created_at, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CONVERT('leads' USING utf8mb4) COLLATE utf8mb4_general_ci AS key2,
      COUNT(*) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_leads
    WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
    GROUP BY CONVERT(DATE_FORMAT(created_at, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci
    UNION ALL
    SELECT
      CONVERT('leads_monthly' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT(DATE_FORMAT(created_at, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CONVERT('converted' USING utf8mb4) COLLATE utf8mb4_general_ci AS key2,
      SUM(CASE WHEN LOWER(status) = 'converted' THEN 1 ELSE 0 END) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_leads
    WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
    GROUP BY CONVERT(DATE_FORMAT(created_at, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci
    UNION ALL
    SELECT
      CONVERT('registrations_monthly' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT(DATE_FORMAT(date_registered, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CONVERT('registered' USING utf8mb4) COLLATE utf8mb4_general_ci AS key2,
      COUNT(*) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_events_attendees
    WHERE date_registered >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
    GROUP BY CONVERT(DATE_FORMAT(date_registered, '%Y-%m') USING utf8mb4) COLLATE utf8mb4_general_ci
    UNION ALL
    SELECT
      CONVERT('articles_by_category' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT(category USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS key2,
      SUM(CASE WHEN LOWER(article_status) = 'published' THEN 1 ELSE 0 END) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM bbs_articles
    GROUP BY CONVERT(category USING utf8mb4) COLLATE utf8mb4_general_ci
    UNION ALL
    SELECT
      CONVERT('events_registration' USING utf8mb4) COLLATE utf8mb4_general_ci AS report_type,
      CONVERT(e.title USING utf8mb4) COLLATE utf8mb4_general_ci AS key1,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS key2,
      IFNULL(a.registered, 0) AS value1,
      NULL AS value2,
      CAST(NULL AS CHAR) COLLATE utf8mb4_general_ci AS color
    FROM (
      SELECT id, title
      FROM bbs_events
      ORDER BY id DESC
      LIMIT 8
    ) e
    LEFT JOIN (
      SELECT event_id, COUNT(*) AS registered
      FROM bbs_events_attendees
      GROUP BY event_id
    ) a ON a.event_id = e.id;
  `);
}

async function migrateLogs() {
  const exists = await tableExists("bbs_logs");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        action VARCHAR(1024) NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        PRIMARY KEY (id),
        KEY idx_bbs_logs_user_id (user_id),
        KEY idx_bbs_logs_date_time (date, time),
        CONSTRAINT fk_bbs_logs_user_id FOREIGN KEY (user_id) REFERENCES auth(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["user_id", "ALTER TABLE bbs_logs ADD COLUMN user_id BIGINT UNSIGNED NOT NULL"],
    ["action", "ALTER TABLE bbs_logs ADD COLUMN action VARCHAR(1024) NOT NULL"],
    ["date", "ALTER TABLE bbs_logs ADD COLUMN date DATE NOT NULL"],
    ["time", "ALTER TABLE bbs_logs ADD COLUMN time TIME NOT NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_logs", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_logs", "idx_bbs_logs_user_id"))) {
    await pool.query("ALTER TABLE bbs_logs ADD KEY idx_bbs_logs_user_id (user_id)");
  }
  if (!(await indexExists("bbs_logs", "idx_bbs_logs_date_time"))) {
    await pool.query("ALTER TABLE bbs_logs ADD KEY idx_bbs_logs_date_time (date, time)");
  }

  if (!(await constraintExists("fk_bbs_logs_user_id"))) {
    await pool.query("ALTER TABLE bbs_logs ADD CONSTRAINT fk_bbs_logs_user_id FOREIGN KEY (user_id) REFERENCES auth(id)");
  }
}

async function migrateLogsView() {
  await pool.query(`
    CREATE OR REPLACE VIEW bbs_logs_view AS
    SELECT
      l.id,
      l.user_id,
      CONCAT(a.first_name, ' ', a.last_name) AS full_name,
      a.role,
      l.action,
      l.date,
      l.time
    FROM bbs_logs l
    INNER JOIN auth a ON a.id = l.user_id;
  `);
}

async function migrateDatasheets() {
  const exists = await tableExists("bbs_datasheets");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_datasheets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT NULL,
        file_path VARCHAR(1024) NOT NULL,
        size BIGINT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        added_by BIGINT UNSIGNED NULL,
        PRIMARY KEY (id),
        KEY idx_bbs_datasheets_date_created (date_created),
        KEY idx_bbs_datasheets_status (status),
        KEY idx_bbs_datasheets_added_by (added_by),
        CONSTRAINT fk_bbs_datasheets_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["title", "ALTER TABLE bbs_datasheets ADD COLUMN title VARCHAR(255) NOT NULL"],
    ["description", "ALTER TABLE bbs_datasheets ADD COLUMN description LONGTEXT NULL"],
    ["file_path", "ALTER TABLE bbs_datasheets ADD COLUMN file_path VARCHAR(1024) NOT NULL"],
    ["size", "ALTER TABLE bbs_datasheets ADD COLUMN size BIGINT UNSIGNED NULL"],
    ["status", "ALTER TABLE bbs_datasheets ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'"],
    ["date_created", "ALTER TABLE bbs_datasheets ADD COLUMN date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ["added_by", "ALTER TABLE bbs_datasheets ADD COLUMN added_by BIGINT UNSIGNED NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_datasheets", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_datasheets", "idx_bbs_datasheets_date_created"))) {
    await pool.query("ALTER TABLE bbs_datasheets ADD KEY idx_bbs_datasheets_date_created (date_created)");
  }
  if (!(await indexExists("bbs_datasheets", "idx_bbs_datasheets_status"))) {
    await pool.query("ALTER TABLE bbs_datasheets ADD KEY idx_bbs_datasheets_status (status)");
  }
  if (!(await indexExists("bbs_datasheets", "idx_bbs_datasheets_added_by"))) {
    await pool.query("ALTER TABLE bbs_datasheets ADD KEY idx_bbs_datasheets_added_by (added_by)");
  }

  if (!(await constraintExists("fk_bbs_datasheets_added_by"))) {
    await pool.query(
      "ALTER TABLE bbs_datasheets ADD CONSTRAINT fk_bbs_datasheets_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL"
    );
  }
}

async function migrateInfoVideos() {
  const exists = await tableExists("bbs_info_videos");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_info_videos (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT NULL,
        file_path VARCHAR(1024) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        added_by BIGINT UNSIGNED NULL,
        PRIMARY KEY (id),
        KEY idx_bbs_info_videos_date_created (date_created),
        KEY idx_bbs_info_videos_status (status),
        KEY idx_bbs_info_videos_added_by (added_by),
        CONSTRAINT fk_bbs_info_videos_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    return;
  }

  const requiredColumns = [
    ["title", "ALTER TABLE bbs_info_videos ADD COLUMN title VARCHAR(255) NOT NULL"],
    ["description", "ALTER TABLE bbs_info_videos ADD COLUMN description LONGTEXT NULL"],
    ["file_path", "ALTER TABLE bbs_info_videos ADD COLUMN file_path VARCHAR(1024) NOT NULL"],
    ["status", "ALTER TABLE bbs_info_videos ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'"],
    ["date_created", "ALTER TABLE bbs_info_videos ADD COLUMN date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ["added_by", "ALTER TABLE bbs_info_videos ADD COLUMN added_by BIGINT UNSIGNED NULL"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_info_videos", name))) {
      await pool.query(sql);
    }
  }

  if (!(await indexExists("bbs_info_videos", "idx_bbs_info_videos_date_created"))) {
    await pool.query("ALTER TABLE bbs_info_videos ADD KEY idx_bbs_info_videos_date_created (date_created)");
  }
  if (!(await indexExists("bbs_info_videos", "idx_bbs_info_videos_status"))) {
    await pool.query("ALTER TABLE bbs_info_videos ADD KEY idx_bbs_info_videos_status (status)");
  }
  if (!(await indexExists("bbs_info_videos", "idx_bbs_info_videos_added_by"))) {
    await pool.query("ALTER TABLE bbs_info_videos ADD KEY idx_bbs_info_videos_added_by (added_by)");
  }

  if (!(await constraintExists("fk_bbs_info_videos_added_by"))) {
    await pool.query(
      "ALTER TABLE bbs_info_videos ADD CONSTRAINT fk_bbs_info_videos_added_by FOREIGN KEY (added_by) REFERENCES auth(id) ON DELETE SET NULL"
    );
  }
}

async function migrateSettings() {
  const exists = await tableExists("bbs_settings");

  if (!exists) {
    await pool.query(`
      CREATE TABLE bbs_settings (
        id BIGINT UNSIGNED NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        email_notifications_enabled TINYINT(1) NOT NULL DEFAULT 0,
        auto_create_lead_from_appointment TINYINT(1) NOT NULL DEFAULT 0,
        auto_followup_reminders_enabled TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(
      `
        INSERT INTO bbs_settings
          (id, company_name, contact_email, contact_number, email_notifications_enabled, auto_create_lead_from_appointment, auto_followup_reminders_enabled)
        VALUES
          (1, 'Black Bear Securities', 'concierge@blackbearsecurities.com', '63286837594', 0, 0, 0)
        ON DUPLICATE KEY UPDATE id = id
      `
    );
    return;
  }

  const requiredColumns = [
    ["company_name", "ALTER TABLE bbs_settings ADD COLUMN company_name VARCHAR(255) NOT NULL"],
    ["contact_email", "ALTER TABLE bbs_settings ADD COLUMN contact_email VARCHAR(255) NOT NULL"],
    ["contact_number", "ALTER TABLE bbs_settings ADD COLUMN contact_number VARCHAR(50) NOT NULL"],
    [
      "email_notifications_enabled",
      "ALTER TABLE bbs_settings ADD COLUMN email_notifications_enabled TINYINT(1) NOT NULL DEFAULT 0",
    ],
    [
      "auto_create_lead_from_appointment",
      "ALTER TABLE bbs_settings ADD COLUMN auto_create_lead_from_appointment TINYINT(1) NOT NULL DEFAULT 0",
    ],
    [
      "auto_followup_reminders_enabled",
      "ALTER TABLE bbs_settings ADD COLUMN auto_followup_reminders_enabled TINYINT(1) NOT NULL DEFAULT 0",
    ],
    ["updated_at", "ALTER TABLE bbs_settings ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!(await columnExists("bbs_settings", name))) {
      await pool.query(sql);
    }
  }

  const [rows] = await pool.query("SELECT id FROM bbs_settings WHERE id = 1 LIMIT 1");
  if (!rows.length) {
    await pool.query(
      `
        INSERT INTO bbs_settings
          (id, company_name, contact_email, contact_number, email_notifications_enabled, auto_create_lead_from_appointment, auto_followup_reminders_enabled)
        VALUES
          (1, 'Black Bear Securities', 'concierge@blackbearsecurities.com', '63286837594', 0, 0, 0)
        ON DUPLICATE KEY UPDATE id = id
      `
    );
  }
}

async function migrateSettingsView() {
  await pool.query(`
    CREATE OR REPLACE VIEW bbs_settings_view AS
    SELECT
      id,
      company_name,
      contact_email,
      contact_number,
      email_notifications_enabled,
      auto_create_lead_from_appointment,
      auto_followup_reminders_enabled,
      updated_at
    FROM bbs_settings
    WHERE id = 1;
  `);
}

async function migratePagedListViews() {
  await pool.query(`
    CREATE OR REPLACE VIEW bbs_appointments_view AS
    SELECT
      id,
      full_name,
      email,
      contact_number,
      service,
      date_set,
      time_set,
      status,
      location,
      duration,
      notes,
      date_created,
      added_by
    FROM bbs_appointments;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW bbs_leads_view AS
    SELECT
      id,
      full_name,
      email,
      contact,
      source,
      status,
      follow_up,
      notes,
      created_at,
      added_by
    FROM bbs_leads;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW bbs_articles_view AS
    SELECT
      id,
      title,
      url_slug,
      category,
      tags,
      featured_image,
      content,
      article_status,
      CASE
        WHEN publish_date IS NULL THEN NULL
        ELSE DATE_FORMAT(publish_date, '%Y-%m-%d')
      END AS publish_date,
      added_by
    FROM bbs_articles;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW bbs_events_view AS
    SELECT
      e.id,
      e.title,
      e.preview_image,
      e.date,
      e.time,
      e.location_type,
      e.location_address,
      e.description,
      e.category,
      e.capacity,
      e.paid_event,
      e.tags,
      e.date_created,
      e.created_by,
      e.added_by,
      (
        SELECT COUNT(*)
        FROM bbs_events_attendees a
        WHERE a.event_id = e.id
      ) AS attendees_count
    FROM bbs_events e;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW bbs_datasheets_view AS
    SELECT
      id,
      title,
      description,
      file_path,
      size,
      status,
      date_created,
      added_by
    FROM bbs_datasheets;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW bbs_info_videos_view AS
    SELECT
      id,
      title,
      description,
      file_path,
      status,
      date_created,
      added_by
    FROM bbs_info_videos;
  `);
}

async function migrate() {
  await migrateAuth();
  await migrateEvents();
  await migrateEventAttendees();
  await migrateArticles();
  await migrateAppointments();
  await migrateLeads();
  await migrateDatasheets();
  await migrateInfoVideos();
  await migrateSettings();
  await migratePagedListViews();
  await migrateReportsView();
  await migrateLogs();
  await migrateLogsView();
  await migrateSettingsView();
}

migrate()
  .then(async () => {
    process.stdout.write("db:migrate ok\n");
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    process.stderr.write(`${err?.stack || err}\n`);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  });
