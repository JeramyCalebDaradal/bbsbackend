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
const { apiLogsIngestRouter, adminApiLogsRouter } = require("../modules/apiLogs/apiLogs.routes");
const { adminSettingsRouter, publicSettingsRouter } = require("../modules/settings/settings.routes");
const { adminRoleConfigRouter } = require("../modules/roleConfig/roleConfig.routes");
const { msGraphRouter } = require("../modules/msGraph/msGraph.routes");
const { requireDashboardAuth } = require("../middleware/requireAuth");
const { requirePageAccess } = require("../middleware/requirePageAccess");

const apiRouter = express.Router();

apiRouter.get("/", (req, res) => {
  res.status(200).json({ name: "bbs-backend", version: "v1" });
});

apiRouter.use("/ms", msGraphRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", requireDashboardAuth, adminRouter);
apiRouter.use("/admin/events", requireDashboardAuth, requirePageAccess("events"), adminEventsRouter);
apiRouter.use("/admin/articles", requireDashboardAuth, requirePageAccess("articles"), adminArticlesRouter);
apiRouter.use("/admin/appointments", requireDashboardAuth, requirePageAccess("appointments"), adminAppointmentsRouter);
apiRouter.use("/admin/leads", requireDashboardAuth, requirePageAccess("leads"), adminLeadsRouter);
apiRouter.use("/admin/datasheets", requireDashboardAuth, requirePageAccess("datasheets"), adminDatasheetsRouter);
apiRouter.use("/admin/info-videos", requireDashboardAuth, requirePageAccess("videos"), adminInfoVideosRouter);
apiRouter.use("/admin/reports", requireDashboardAuth, requirePageAccess("reports"), adminReportsRouter);
apiRouter.use("/admin/logs", requireDashboardAuth, requirePageAccess("logs"), adminLogsRouter);
apiRouter.use("/api-logs", apiLogsIngestRouter);
apiRouter.use("/admin/api-logs", requireDashboardAuth, requirePageAccess("api-logs"), adminApiLogsRouter);
apiRouter.use("/admin/settings", requireDashboardAuth, requirePageAccess("settings"), adminSettingsRouter);
apiRouter.use("/admin/role-config", requireDashboardAuth, requirePageAccess("roles"), adminRoleConfigRouter);
apiRouter.use("/events", publicEventsRouter);
apiRouter.use("/articles", publicArticlesRouter);
apiRouter.use("/datasheets", publicDatasheetsRouter);
apiRouter.use("/info-videos", publicInfoVideosRouter);
apiRouter.use("/settings", publicSettingsRouter);

module.exports = { apiRouter };
