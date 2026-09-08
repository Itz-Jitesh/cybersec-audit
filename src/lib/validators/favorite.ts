import { z } from "zod";

export const favoriteEntitySchema = z.enum([
  "project",
  "cycle",
  "module",
  "view",
  "page",
]);

export const toggleFavoriteSchema = z.object({
  entityType: favoriteEntitySchema,
  entityId: z.string().uuid(),
});

export type FavoriteEntity = z.infer<typeof favoriteEntitySchema>;
