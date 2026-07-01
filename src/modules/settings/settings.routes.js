const express = require("express");
const {
  getAdminSettingsController,
  getPublicSettingsController,
  updateAdminSettingsController,
} = require("./settings.controller");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { validate } = require("../../middleware/validate");
const { z } = require("zod");

const updateSettingsSchema = z.object({
  company_name: z.string().min(1).max(255).trim(),
  contact_email: z.string().email().max(255).trim().toLowerCase(),
  contact_number: z.string().min(1).max(50).trim(),
  info_videos_enabled: z.boolean().optional(),
  auto_create_lead_from_appointment: z.boolean().optional(),
  email_notifications_enabled: z.boolean().optional(),
  auto_followup_reminders_enabled: z.boolean().optional(),
});

const SETTINGS_ROLES = ["Super Admin", "System Admin"];

const publicSettingsRouter = express.Router();
publicSettingsRouter.get("/", getPublicSettingsController);

const adminSettingsRouter = express.Router();

adminSettingsRouter.get("/", requireAuth, requireRole(...SETTINGS_ROLES), getAdminSettingsController);

adminSettingsRouter.put("/", requireAuth, requireRole(...SETTINGS_ROLES), validate(updateSettingsSchema), updateAdminSettingsController);

module.exports = { publicSettingsRouter, adminSettingsRouter };