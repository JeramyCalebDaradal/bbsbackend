const { z } = require("zod");

const MAX_CONTENT_LENGTH = 50000;

const createArticleSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  url_slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().min(1).max(100).trim(),
  featured_image: z.string().max(10000000).optional().default(""),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH).trim(),
  article_status: z.enum(["Published", "Draft", "Archived", "published", "draft", "archived"]),
  publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().default(null),
  tags: z
    .union([z.array(z.string().min(1)), z.string()])
    .optional()
    .default([]),
  added_by: z.number().int().positive(),
});

const updateArticleSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  url_slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().min(1).max(100).trim(),
  featured_image: z.string().max(10000000).optional().default(""),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH).trim(),
  article_status: z.enum(["Published", "Draft", "Archived", "published", "draft", "archived"]),
  publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().default(null),
  tags: z
    .union([z.array(z.string().min(1)), z.string()])
    .optional()
    .default([]),
});

module.exports = { createArticleSchema, updateArticleSchema };