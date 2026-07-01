const { z } = require("zod");

const createInfoVideoSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional().nullable().default(null),
  file_path: z.string().min(1).max(500).trim(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  added_by: z.number().int().positive(),
});

const updateInfoVideoSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional().nullable().default(null),
  file_path: z.string().min(1).max(500).trim(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

module.exports = { createInfoVideoSchema, updateInfoVideoSchema };