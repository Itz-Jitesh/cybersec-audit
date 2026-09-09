import { z } from "zod";

/**
 * Command palette search.
 *
 * One debounced query from the client, returning the top rows from every
 * searchable entity in one round trip per entity. Every query is scoped to
 * rows the user can see: issues and cycles through project membership, pages
 * through the same public-or-owner rule as saved views.
 */

export const paletteSearchSchema = z.object({
  query: z.string().trim().min(1).max(100),
});

export type PaletteSearchInput = z.infer<typeof paletteSearchSchema>;
