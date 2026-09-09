import { asc, count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { type AdminTeam, TeamsAdmin } from "@/components/admin/teams-admin";
import { db } from "@/db";
import { projects, teams } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function AdminTeamsPage() {
  const user = await requireUser();
  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) notFound();

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
    <div>
      <h1 className="text-sm font-medium text-text-100">Teams</h1>
      <p className="mt-0.5 text-xs text-text-400">
        Teams scope every project and every read below it.
      </p>
      <div className="mt-4">
        <TeamsAdmin teams={adminTeams} />
      </div>
    </div>
  );
}
