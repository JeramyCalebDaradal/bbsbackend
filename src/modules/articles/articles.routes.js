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
const { requireRole } = require("../../middleware/requireRole");
const { createArticleSchema, updateArticleSchema } = require("../../validators/articleSchemas");

const adminArticlesRouter = express.Router();
const publicArticlesRouter = express.Router();

const ARTICLE_ROLES = ["Administrator", "ContentManager"];

adminArticlesRouter.use(requireRole(...ARTICLE_ROLES));
adminArticlesRouter.get("/", listArticlesController);
adminArticlesRouter.post("/", validate(createArticleSchema), createArticleController);
adminArticlesRouter.put("/:id", validate(updateArticleSchema), updateArticleController);
adminArticlesRouter.delete("/:id", deleteArticleController);

publicArticlesRouter.get("/", listPublishedArticlesController);
publicArticlesRouter.get("/:slug", getPublishedArticleBySlugController);

module.exports = { adminArticlesRouter, publicArticlesRouter };
