import { z } from "zod";

/** The twelve-colour palette offered for states and labels. */
export const PALETTE = [
  "#6b7280",
  "#9ca3af",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#16a34a",
  "#14b8a6",
  "#3b82f6",
  "#3f76ff",
  "#8b5cf6",
  "#ec4899",
] as const;

const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour from the palette.");

/**
 * Two to five uppercase letters. This becomes the prefix of every issue id in
 * the project — CTF-142 — so it is deliberately short and cannot be changed
 * casually once issues exist.
 */
export const identifierSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "Identifier must be at least 2 letters.")
  .max(5, "Identifier must be at most 5 letters.")
  .regex(/^[A-Z]+$/, "Use letters only.");

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  identifier: identifierSchema,
  teamId: z.string().uuid("Choose a team."),
  leadId: z.string().uuid().optional().or(z.literal("")),
  iconEmoji: z.string().trim().max(8).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  iconEmoji: z.string().trim().max(8).optional().or(z.literal("")),
  leadId: z.string().uuid().nullable().optional(),
});

export const projectIdSchema = z.object({ projectId: z.string().uuid() });

export const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
  /** Compared against the project name in the action, never trusted from the UI. */
  confirmation: z.string(),
});

export const projectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const setProjectRoleSchema = projectMemberSchema.extend({
  role: z.enum(["admin", "member"]),
});

export const stateGroupSchema = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);

export const createStateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required.").max(40),
  group: stateGroupSchema,
  color: colorSchema,
});

export const updateStateSchema = z.object({
  stateId: z.string().uuid(),
  name: z.string().trim().min(1).max(40).optional(),
  group: stateGroupSchema.optional(),
  color: colorSchema.optional(),
  isDefault: z.boolean().optional(),
});

export const reorderStateSchema = z.object({
  stateId: z.string().uuid(),
  /** The states either side of the drop position; either may be absent at an edge. */
  beforeId: z.string().uuid().nullable(),
  afterId: z.string().uuid().nullable(),
});

export const stateIdSchema = z.object({ stateId: z.string().uuid() });

export const createLabelSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required.").max(40),
  color: colorSchema,
});

export const updateLabelSchema = z.object({
  labelId: z.string().uuid(),
  name: z.string().trim().min(1).max(40).optional(),
  color: colorSchema.optional(),
});

export const labelIdSchema = z.object({ labelId: z.string().uuid() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Suggests an identifier from a project name: letters only, uppercased, first
 * five. "CTF Platform" becomes CTFPL. The form stops calling this once the user
 * edits the field by hand.
 */
export function suggestIdentifier(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 5);
}
