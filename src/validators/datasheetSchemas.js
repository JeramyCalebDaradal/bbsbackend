const { z } = require("zod");

const createDatasheetSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional().nullable().default(null),
  file_path: z.string().min(1).max(500).trim(),
  size: z.number().int().nonnegative().optional().nullable().default(null),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  added_by: z.number().int().positive(),
});

const updateDatasheetSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional().nullable().default(null),
  file_path: z.string().min(1).max(500).trim(),
  size: z.number().int().nonnegative().optional().nullable().default(null),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

module.exports = { createDatasheetSchema, updateDatasheetSchema };