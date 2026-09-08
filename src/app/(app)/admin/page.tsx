import { asc, count, eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";

import { type AdminTeam, TeamsAdmin } from "@/components/admin/teams-admin";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/db";
import { projects, teams } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

/**
 * Members, invites and the audit log arrive in phase 11. Team management lives
 * here now because phase 7 owns team CRUD, and actions with no way to reach
 * them are not a feature.
 */
export default async function AdminPage() {
  const user = await requireUser();

  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) {
    return (
      <div className="mx-auto max-w-[1000px] px-6 pt-4">
        <h1 className="text-xl font-semibold text-text-100">Admin</h1>
        <div className="mt-4 rounded-lg border border-border-subtle">
          <EmptyState
            icon={ShieldAlert}
            title="This area is for workspace admins"
            description="Ask a club admin, the president or a co-president if you need something changed here."
          />
        </div>
      </div>
    );
  }

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      description: teams.description,
      color: teams.color,
      projectCount: count(projects.id),
    })
    .from(teams)
    .leftJoin(projects, eq(projects.teamId, teams.id))
    .groupBy(teams.id, teams.name, teams.slug, teams.description, teams.color)
    .orderBy(asc(teams.name))
    .limit(50);

  const adminTeams: AdminTeam[] = rows.map((row) => ({
    ...row,
    projectCount: Number(row.projectCount),
  }));

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-4 pb-10">
      <h1 className="text-xl font-semibold text-text-100">Admin</h1>
      <p className="mt-0.5 text-sm text-text-300">
        Members, invites and the audit log arrive in phase 11.
      </p>

      <div className="mt-6">
        <TeamsAdmin teams={adminTeams} />
      </div>
    </div>
  );
}
