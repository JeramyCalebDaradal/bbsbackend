const express = require("express");
const {
  createArticleController,
  deleteArticleController,
  getPublishedArticleBySlugController,
  listArticlesController,
  listPublishedArticlesController,
  updateArticleController,
} = require("./articles.controller");

const adminArticlesRouter = express.Router();
const publicArticlesRouter = express.Router();

adminArticlesRouter.get("/", listArticlesController);
adminArticlesRouter.post("/", createArticleController);
adminArticlesRouter.put("/:id", updateArticleController);
adminArticlesRouter.delete("/:id", deleteArticleController);

publicArticlesRouter.get("/", listPublishedArticlesController);
publicArticlesRouter.get("/:slug", getPublishedArticleBySlugController);

module.exports = { adminArticlesRouter, publicArticlesRouter };
