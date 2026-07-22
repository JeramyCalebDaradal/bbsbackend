const {
  findById,
  findBySlug,
  findPublishedBySlug,
  deleteArticleById,
  insertArticle,
  listArticles,
  listPublishedArticles,
  updateArticleById,
} = require("./articles.repository");
const { normalizeImageField, signUrl, signUrls, deleteFromS3 } = require("../../utils/bucketStorage");
const { sanitizeHtml } = require("../../utils/sanitizeHtml");

function ensureString(value, fieldName) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function ensurePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const int = Math.trunc(n);
  if (int <= 0) {
    const err = new Error(`${fieldName} must be > 0`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return int;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((t) => String(t || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function parseTagsField(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function normalizeSlug(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) {
    const err = new Error("url_slug is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) {
    const err = new Error("url_slug is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeStatus(value) {
  const raw = String(value || "").trim();
  const v = raw.toLowerCase();
  if (v === "published") return "Published";
  if (v === "archived") return "Archived";
  if (v === "draft") return "Draft";

  if (raw === "Published") return "Published";
  if (raw === "Archived") return "Archived";
  if (raw === "Draft") return "Draft";

  {
    const err = new Error("Invalid input");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
}

function normalizePublishDate(value, status) {
  const v = String(value || "").trim();
  if (!v) {
    return status === "Published" ? (() => {
      const err = new Error("publish_date is required when article_status is Published");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    })() : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const err = new Error("publish_date must be YYYY-MM-DD");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeFeaturedImage(value) {
  const v = String(value || "").trim();
  return v;
}

function publicArticle(row) {
  return {
    id: row.id,
    title: row.title,
    url_slug: row.url_slug,
    category: row.category,
    tags: parseTagsField(row.tags),
    featured_image: row.featured_image,
    content: row.content,
    article_status: row.article_status,
    publish_date: row.publish_date,
    added_by: row.added_by,
  };
}

function normalizePage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.trunc(n);
}

async function getArticles(query) {
  const page = normalizePage(query?.page);
  const q = String(query?.q || "").trim();
  const result = await listArticles({ page, query: q });
  const articles = result.rows.map(publicArticle);
  await signUrls(articles, ["featured_image"]);
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    articles,
  };
}

async function createArticle(payload) {
  const title = ensureString(payload?.title, "title");
  const urlSlug = normalizeSlug(payload?.url_slug);
  const category = ensureString(payload?.category, "category");
  const featuredImageRaw = normalizeFeaturedImage(payload?.featured_image);
  const featuredImage = await normalizeImageField({
    value: featuredImageRaw,
    dirKey: "articlesFeaturedImage",
    contextLabel: "Article post error",
  });
  const content = sanitizeHtml(ensureString(payload?.content, "content"));
  const articleStatus = normalizeStatus(payload?.article_status);
  const publishDate = normalizePublishDate(payload?.publish_date, articleStatus);
  const tags = normalizeTags(payload?.tags);
  const addedBy = ensurePositiveInt(payload?.added_by, "added_by");

  const existing = await findBySlug(urlSlug);
  if (existing) {
    const err = new Error("url_slug already exists");
    err.statusCode = 409;
    err.code = "SLUG_EXISTS";
    throw err;
  }

  const id = await insertArticle({
    title,
    urlSlug,
    category,
    tagsJson: JSON.stringify(tags),
    featuredImage,
    content,
    articleStatus,
    publishDate,
    addedBy,
  });

  const created = await findById(id);
  const article = publicArticle(created);
  if (article.featured_image) article.featured_image = await signUrl(article.featured_image);
  return article;
}

async function updateArticle(id, payload) {
  const articleId = Number(id);
  if (!Number.isFinite(articleId) || articleId <= 0) {
    const err = new Error("id is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const existing = await findById(articleId);
  if (!existing) {
    const err = new Error("Article not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const title = ensureString(payload?.title, "title");
  const urlSlug = normalizeSlug(payload?.url_slug);
  const category = ensureString(payload?.category, "category");
  const featuredImageRaw = normalizeFeaturedImage(payload?.featured_image);
  const featuredImage = await normalizeImageField({
    value: featuredImageRaw,
    dirKey: "articlesFeaturedImage",
    contextLabel: "Article post error",
  });

  // Clean up old S3 image if replaced
  const oldImageKey = String(existing?.featured_image || "").trim();
  if (oldImageKey && oldImageKey !== featuredImage) {
    deleteFromS3(oldImageKey);
  }

  const content = sanitizeHtml(ensureString(payload?.content, "content"));
  const articleStatus = normalizeStatus(payload?.article_status);
  const publishDate = normalizePublishDate(payload?.publish_date, articleStatus);
  const tags = normalizeTags(payload?.tags);

  const slugOwner = await findBySlug(urlSlug);
  if (slugOwner && Number(slugOwner.id) !== articleId) {
    const err = new Error("url_slug already exists");
    err.statusCode = 409;
    err.code = "SLUG_EXISTS";
    throw err;
  }

  await updateArticleById(articleId, {
    title,
    urlSlug,
    category,
    tagsJson: JSON.stringify(tags),
    featuredImage,
    content,
    articleStatus,
    publishDate,
  });

  const updated = await findById(articleId);
  const article = publicArticle(updated);
  if (article.featured_image) article.featured_image = await signUrl(article.featured_image);
  return article;
}

async function deleteArticle(id) {
  const articleId = Number(id);
  if (!Number.isFinite(articleId) || articleId <= 0) {
    const err = new Error("id is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const existing = await findById(articleId);
  if (!existing) {
    const err = new Error("Article not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  // Clean up S3 image before deleting record
  const imageKey = String(existing?.featured_image || "").trim();
  if (imageKey) {
    deleteFromS3(imageKey);
  }

  await deleteArticleById(articleId);
  return publicArticle(existing);
}

async function getPublishedArticles(query) {
  const page = normalizePage(query?.page);
  const q = String(query?.q || "").trim();
  const result = await listPublishedArticles({ page, query: q });
  const articles = result.rows.map(publicArticle);
  await signUrls(articles, ["featured_image"]);
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    articles,
  };
}

async function getPublishedArticleBySlug(slug) {
  const urlSlug = normalizeSlug(slug);
  const row = await findPublishedBySlug(urlSlug);
  if (!row) {
    const err = new Error("Article not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  const article = publicArticle(row);
  if (article.featured_image) article.featured_image = await signUrl(article.featured_image);
  return article;
}

module.exports = {
  getArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  getPublishedArticles,
  getPublishedArticleBySlug,
};
