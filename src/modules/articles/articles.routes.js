const express = require("express");
const {
  createArticleController,
  deleteArticleController,
  getPublishedArticleBySlugController,
  listArticlesController,
  listPublishedArticlesController,
  updateArticleController,
} = require("./articles.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { createArticleSchema, updateArticleSchema } = require("../../validators/articleSchemas");

const adminArticlesRouter = express.Router();
const publicArticlesRouter = express.Router();

const ARTICLE_ROLES = ["Super Admin", "Content Manager"];

adminArticlesRouter.get("/", requireAuth, requireRole(...ARTICLE_ROLES), listArticlesController);
adminArticlesRouter.post("/", validate(createArticleSchema), createArticleController);
adminArticlesRouter.put("/:id", validate(updateArticleSchema), updateArticleController);
adminArticlesRouter.delete("/:id", deleteArticleController);

publicArticlesRouter.get("/", listPublishedArticlesController);
publicArticlesRouter.get("/:slug", getPublishedArticleBySlugController);

module.exports = { adminArticlesRouter, publicArticlesRouter };