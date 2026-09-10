import { asc, countDistinct, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

import { TeamMembersPanel } from "@/components/admin/team-members-panel";
import { type AdminTeam, TeamsAdmin } from "@/components/admin/teams-admin";
import { db } from "@/db";
import { getTeamWithMembers, getWorkspaceMembersNotInTeam } from "@/db/queries/teams";
import { profiles, projects, teamMembers, teams } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface AdminTeamsPageProps {
  searchParams: Promise<{ team?: string }>;
}

export default async function AdminTeamsPage({
  searchParams,
}: AdminTeamsPageProps) {
  const user = await requireUser();
  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) notFound();

  const { team: managingTeamId } = await searchParams;

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      description: teams.description,
      color: teams.color,
      // countDistinct, not count: the two left joins multiply each other's
      // rows, so a plain count would report members × projects.
      projectCount: countDistinct(projects.id),
      memberCount: countDistinct(teamMembers.userId),
      leads: sql<
        { id: string; displayName: string; avatarUrl: string | null }[]
      >`coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'id', ${profiles.id},
            'displayName', ${profiles.displayName},
            'avatarUrl', ${profiles.avatarUrl}
          )
        ) filter (where ${teamMembers.role} = 'lead' and ${profiles.id} is not null),
        '[]'::jsonb
      )`,
    })
    .from(teams)
    .leftJoin(projects, eq(projects.teamId, teams.id))
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
    .groupBy(teams.id, teams.name, teams.slug, teams.description, teams.color)
    .orderBy(asc(teams.name))
    .limit(50);

  const adminTeams: AdminTeam[] = rows.map((row) => ({
    ...row,
    projectCount: Number(row.projectCount),
    memberCount: Number(row.memberCount),
    leads: row.leads ?? [],
  }));

  // Only the expanded team costs the extra two queries.
  const managed = managingTeamId
    ? await getTeamWithMembers(managingTeamId)
    : null;
  const addable = managed
    ? await getWorkspaceMembersNotInTeam(managed.id)
    : [];

  return (
    <div>
      <h1 className="text-sm font-medium text-text-100">Teams</h1>
      <p className="mt-0.5 text-xs text-text-400">
        Teams scope every project and every read below it.
      </p>
      <div className="mt-4">
        <TeamsAdmin teams={adminTeams} managingTeamId={managed?.id} />
      </div>

      {managed && (
        <section className="mt-5">
          <h2 className="text-sm font-medium text-text-200">
            {managed.name} · membership
          </h2>
          <p className="mt-0.5 text-xs text-text-400">
            Leads can manage their own team. Workspace admins can manage any.
          </p>
          <div className="mt-3">
            <TeamMembersPanel
              team={{ id: managed.id, name: managed.name }}
              members={managed.members}
              addableMembers={addable}
              canManage
            />
          </div>
        </section>
      )}
    </div>
  );
}
