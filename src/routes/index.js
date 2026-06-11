const express = require("express");
const { adminRouter, authRouter } = require("../modules/auth/auth.routes");
const { adminEventsRouter, publicEventsRouter } = require("../modules/events/events.routes");
const { adminArticlesRouter, publicArticlesRouter } = require("../modules/articles/articles.routes");
const { adminAppointmentsRouter } = require("../modules/appointments/appointments.routes");
const { adminLeadsRouter } = require("../modules/leads/leads.routes");
const { adminDatasheetsRouter, publicDatasheetsRouter } = require("../modules/datasheets/datasheets.routes");
const { adminInfoVideosRouter, publicInfoVideosRouter } = require("../modules/infoVideos/infoVideos.routes");
const { adminReportsRouter } = require("../modules/reports/reports.routes");
const { adminLogsRouter } = require("../modules/logs/logs.routes");
const { requireAuth } = require("../middleware/requireAuth");

const apiRouter = express.Router();

apiRouter.get("/", (req, res) => {
  res.status(200).json({ name: "bbs-backend", version: "v1" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", requireAuth, adminRouter);
apiRouter.use("/admin/events", requireAuth, adminEventsRouter);
apiRouter.use("/admin/articles", requireAuth, adminArticlesRouter);
apiRouter.use("/admin/appointments", requireAuth, adminAppointmentsRouter);
apiRouter.use("/admin/leads", requireAuth, adminLeadsRouter);
apiRouter.use("/admin/datasheets", requireAuth, adminDatasheetsRouter);
apiRouter.use("/admin/info-videos", requireAuth, adminInfoVideosRouter);
apiRouter.use("/admin/reports", requireAuth, adminReportsRouter);
apiRouter.use("/admin/logs", requireAuth, adminLogsRouter);
apiRouter.use("/events", publicEventsRouter);
apiRouter.use("/articles", publicArticlesRouter);
apiRouter.use("/datasheets", publicDatasheetsRouter);
apiRouter.use("/info-videos", publicInfoVideosRouter);

module.exports = { apiRouter };
