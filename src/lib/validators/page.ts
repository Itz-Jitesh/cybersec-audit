import { z } from "zod";

/**
 * Pages are TipTap documents. The HTML is sanitised at the action boundary the
 * same way comments are, so what is validated here is only shape and size.
 */

export const pageAccessSchema = z.enum(["private", "public"]);

export const createPageSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Give the page a title.").max(200),
  access: pageAccessSchema.default("private"),
});

export const updatePageSchema = z.object({
  pageId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  contentHtml: z.string().max(500_000).optional(),
  contentJson: z.unknown().optional(),
  access: pageAccessSchema.optional(),
});

export const pageIdSchema = z.object({ pageId: z.string().uuid() });
