import { z } from "zod";

import { PALETTE } from "@/lib/validators/project";

const nameSchema = z.string().trim().min(1, "Name is required.").max(120);

export const moduleStatusSchema = z.enum([
  "planned",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
]);

export type ModuleStatus = z.infer<typeof moduleStatusSchema>;

export const createModuleSchema = z.object({
  projectId: z.string().uuid(),
  name: nameSchema,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  leadId: z.string().uuid().nullable().optional(),
  status: moduleStatusSchema.default("planned"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")
    .nullable()
    .optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")
    .nullable()
    .optional(),
});

export const updateModuleSchema = z.object({
  moduleId: z.string().uuid(),
  name: nameSchema.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  status: moduleStatusSchema.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")
    .nullable()
    .optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")
    .nullable()
    .optional(),
});

export const moduleIdSchema = z.object({ moduleId: z.string().uuid() });

export const assignModuleIssuesSchema = z.object({
  moduleId: z.string().uuid(),
  issueIds: z.array(z.string().uuid()).min(1).max(100),
});

export const removeModuleIssueSchema = z.object({
  moduleId: z.string().uuid(),
  issueId: z.string().uuid(),
});

export { PALETTE };
