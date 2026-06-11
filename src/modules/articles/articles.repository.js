const { pool } = require("../../db/pool");

function normalizePaging({ page }) {
  const p = Number(page);
  const pageSafe = Number.isFinite(p) && p > 0 ? Math.trunc(p) : 1;
  const pageSize = 20;
  const offset = (pageSafe - 1) * pageSize;
  return { page: pageSafe, pageSize, offset };
}

async function listArticles({ page, query }) {
  const { page: pageSafe, pageSize, offset } = normalizePaging({ page });
  const where = [];
  const params = {};

  const q = String(query || "").trim();
  if (q) {
    where.push(
      "(LOWER(title) LIKE :qLike OR LOWER(category) LIKE :qLike OR LOWER(url_slug) LIKE :qLike)"
    );
    params.qLike = `%${q.toLowerCase()}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        url_slug,
        category,
        tags,
        featured_image,
        content,
        article_status,
        publish_date,
        added_by
      FROM bbs_articles_view
      ${whereSql}
      ORDER BY id DESC
      LIMIT :limit
      OFFSET :offset
    `,
    { ...params, limit: pageSize, offset }
  );

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM bbs_articles_view
      ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize, total };
}

async function findById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        url_slug,
        category,
        tags,
        featured_image,
        content,
        article_status,
        publish_date,
        added_by
      FROM bbs_articles
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function findBySlug(slug) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        url_slug,
        category,
        tags,
        featured_image,
        content,
        article_status,
        publish_date,
        added_by
      FROM bbs_articles
      WHERE url_slug = ?
      LIMIT 1
    `,
    [slug]
  );
  return rows[0] || null;
}

async function listPublishedArticles({ page, query }) {
  const { page: pageSafe, pageSize, offset } = normalizePaging({ page });
  const where = ["LOWER(article_status) = 'published'"];
  const params = {};

  const q = String(query || "").trim();
  if (q) {
    where.push(
      "(LOWER(title) LIKE :qLike OR LOWER(category) LIKE :qLike OR LOWER(url_slug) LIKE :qLike)"
    );
    params.qLike = `%${q.toLowerCase()}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        url_slug,
        category,
        tags,
        featured_image,
        content,
        article_status,
        publish_date,
        added_by
      FROM bbs_articles_view
      ${whereSql}
      ORDER BY publish_date DESC, id DESC
      LIMIT :limit
      OFFSET :offset
    `,
    { ...params, limit: pageSize, offset }
  );

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM bbs_articles_view
      ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize, total };
}

async function findPublishedBySlug(slug) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        url_slug,
        category,
        tags,
        featured_image,
        content,
        article_status,
        publish_date,
        added_by
      FROM bbs_articles
      WHERE url_slug = ?
        AND LOWER(article_status) = 'published'
      LIMIT 1
    `,
    [slug]
  );
  return rows[0] || null;
}

async function insertArticle({
  title,
  urlSlug,
  category,
  tagsJson,
  featuredImage,
  content,
  articleStatus,
  publishDate,
  addedBy,
}) {
  const [result] = await pool.query(
    `
      INSERT INTO bbs_articles
        (title, url_slug, category, tags, featured_image, content, article_status, publish_date, added_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [title, urlSlug, category, tagsJson, featuredImage, content, articleStatus, publishDate, addedBy ?? null]
  );

  return Number(result.insertId);
}

async function updateArticleById(
  id,
  { title, urlSlug, category, tagsJson, featuredImage, content, articleStatus, publishDate }
) {
  const [result] = await pool.query(
    `
      UPDATE bbs_articles
      SET
        title = ?,
        url_slug = ?,
        category = ?,
        tags = ?,
        featured_image = ?,
        content = ?,
        article_status = ?,
        publish_date = ?
      WHERE id = ?
      LIMIT 1
    `,
    [title, urlSlug, category, tagsJson, featuredImage, content, articleStatus, publishDate, id]
  );

  return Number(result.affectedRows || 0);
}

async function deleteArticleById(id) {
  const [result] = await pool.query(
    `
      DELETE FROM bbs_articles
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return Number(result.affectedRows || 0);
}

module.exports = {
  listArticles,
  findById,
  findBySlug,
  listPublishedArticles,
  findPublishedBySlug,
  insertArticle,
  updateArticleById,
  deleteArticleById,
};
