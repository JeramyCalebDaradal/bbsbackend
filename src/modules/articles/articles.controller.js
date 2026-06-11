const {
  createArticle,
  deleteArticle,
  getArticles,
  getPublishedArticleBySlug,
  getPublishedArticles,
  updateArticle,
} = require("./articles.service");
const { created, edited, recordLog, removed } = require("../logs/logs.service");

async function listArticlesController(req, res, next) {
  try {
    const result = await getArticles(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createArticleController(req, res, next) {
  try {
    const article = await createArticle(req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new article: ${article.title}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, article });
  } catch (err) {
    next(err);
  }
}

async function updateArticleController(req, res, next) {
  try {
    const article = await updateArticle(req.params.id, req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: edited(`an article: ${article.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, article });
  } catch (err) {
    next(err);
  }
}

async function deleteArticleController(req, res, next) {
  try {
    const article = await deleteArticle(req.params.id);
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: removed(`an article: ${article.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, article });
  } catch (err) {
    next(err);
  }
}

async function listPublishedArticlesController(req, res, next) {
  try {
    const result = await getPublishedArticles(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getPublishedArticleBySlugController(req, res, next) {
  try {
    const article = await getPublishedArticleBySlug(req.params.slug);
    res.status(200).json({ ok: true, article });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArticlesController,
  createArticleController,
  updateArticleController,
  deleteArticleController,
  listPublishedArticlesController,
  getPublishedArticleBySlugController,
};
