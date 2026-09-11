import { notFound } from "next/navigation";

import { TeamMembersPanel } from "@/components/admin/team-members-panel";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { TeamProjects } from "@/components/teams/team-projects";
import { getNavigationTree } from "@/db/queries/navigation";
import {
  getTeamBySlug,
  getTeamMembers,
  getTeamProjects,
  getWorkspaceMembers,
} from "@/db/queries/project";
import { getWorkspaceMembersNotInTeam } from "@/db/queries/teams";
import { assertCan, readsWholeWorkspace } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface TeamPageProps {
  params: Promise<{ teamSlug: string }>;
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamSlug } = await params;
  const user = await requireUser();

  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  // The Drizzle connection bypasses RLS, so visibility is decided here rather
  // than left to the database.
  const readable = await assertCan(user, {
    kind: "team.read",
    teamId: team.id,
  });
  if (!readable.ok) notFound();

  // The same ability the actions check. It gates rendering only; every
  // membership action re-runs assertCan server-side regardless of what the UI
  // decided to draw.
  const canManage = await assertCan(user, {
    kind: "team.manage",
    teamId: team.id,
  });

  const [members, projects, tree, workspaceMembers, addableMembers] =
    await Promise.all([
      getTeamMembers(team.id),
      getTeamProjects(team.id, user.id),
      getNavigationTree(user.id, readsWholeWorkspace(user.role)),
      getWorkspaceMembers(),
      canManage.ok
        ? getWorkspaceMembersNotInTeam(team.id)
        : Promise.resolve([]),
    ]);

  const leads = members.filter((member) => member.role === "lead");

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-4 pb-10">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 size-3 shrink-0 rounded-full"
          style={{ backgroundColor: team.color }}
        />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-100">
            {team.logoEmoji ? `${team.logoEmoji} ` : ""}
            {team.name}
          </h1>
          {team.description && (
            <p className="mt-1 text-sm text-text-300">{team.description}</p>
          )}
        </div>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-bg-90 px-4 py-3">
          <p className="text-2xs font-medium tracking-wide text-text-400 uppercase">
            {leads.length === 1 ? "Lead" : "Leads"}
          </p>
          {leads.length === 0 ? (
            <p className="mt-1.5 text-xs text-text-300">No lead assigned.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {leads.map((lead) => (
                <li key={lead.userId} className="flex items-center gap-2">
                  <MemberAvatar
                    user={{
                      id: lead.userId,
                      displayName: lead.displayName,
                      avatarUrl: lead.avatarUrl,
                    }}
                    size={20}
                  />
                  <span className="truncate text-sm text-text-100">
                    {lead.displayName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-90 px-4 py-3">
          <p className="text-2xs font-medium tracking-wide text-text-400 uppercase">
            Members · {members.length}
          </p>
          {members.length === 0 ? (
            <p className="mt-1.5 text-xs text-text-300">
              Nobody has been added to this team yet.
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {members.map((member) => (
                <li key={member.userId} title={member.displayName}>
                  <MemberAvatar
                    user={{
                      id: member.userId,
                      displayName: member.displayName,
                      avatarUrl: member.avatarUrl,
                    }}
                    size={24}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-text-200">Members</h2>
        <div className="mt-2">
          <TeamMembersPanel
            team={{ id: team.id, name: team.name }}
            members={members.map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
              email: member.email,
              avatarUrl: member.avatarUrl,
              role: member.role === "lead" ? "lead" : "member",
            }))}
            addableMembers={addableMembers}
            canManage={canManage.ok}
          />
        </div>
      </section>

      <TeamProjects
        teamId={team.id}
        teamName={team.name}
        projects={projects}
        teams={tree.teams.map((row) => ({ id: row.id, name: row.name }))}
        members={workspaceMembers}
        canCreate={canManage.ok}
      />
    </div>
  );
}
