import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.");

const nameSchema = z.string().trim().min(1, "Name is required.").max(120);

export const createCycleSchema = z
  .object({
    projectId: z.string().uuid(),
    name: nameSchema,
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

export const updateCycleSchema = z
  .object({
    cycleId: z.string().uuid(),
    name: nameSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.startDate <= value.endDate,
    {
      message: "The end date cannot be before the start date.",
      path: ["endDate"],
    },
  );

export const cycleIdSchema = z.object({ cycleId: z.string().uuid() });

export const cycleIssueSearchSchema = z.object({
  cycleId: z.string().uuid(),
  query: z.string().trim().max(120).default(""),
});

export const assignCycleSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(100),
  cycleId: z.string().uuid().nullable(),
});

export const completeCycleSchema = z.object({
  cycleId: z.string().uuid(),
  /** Where incomplete issues go. Null means leave them in the completed cycle. */
  transferToCycleId: z.string().uuid().nullable().optional(),
  moveToBacklog: z.boolean().default(false),
});

export type CreateCycleInput = z.infer<typeof createCycleSchema>;
