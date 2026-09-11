"use server";

import { type ActionResult, guarded, invalid, ok } from "@/actions/result";
import { searchPalette } from "@/db/queries/search";
import { readsWholeWorkspace } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  type PaletteSearchInput,
  paletteSearchSchema,
} from "@/lib/validators/search";

/**
 * Command palette search.
 *
 * Reads only: visibility is resolved inside the query (workspace admins see
 * everything, everyone else sees rows in projects they belong to), so no
 * assertCan project check applies — there is no single project to assert
 * against. The empty query returns empty results without touching the db.
 */
export async function searchPaletteAction(
  input: PaletteSearchInput,
): Promise<ActionResult<
  Awaited<ReturnType<typeof searchPalette>>
>> {
  return guarded("searchPalette", async () => {
    const parsed = paletteSearchSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) {
      return ok({ issues: [], cycles: [], modules: [], pages: [] });
    }
    return ok(
      await searchPalette(
        user.id,
        readsWholeWorkspace(user.role),
        parsed.data.query,
      ),
    );
  });
}
