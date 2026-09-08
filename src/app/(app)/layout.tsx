import { signOut } from "@/actions/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { getUnreadNotificationCount } from "@/db/queries/home";
import { getNavigationTree } from "@/db/queries/navigation";
import { getWorkspaceMembers } from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

const ADMIN_ROLES = new Set(["admin", "president", "co_president"]);

/**
 * The authenticated shell. Fixed to the viewport with the sidebar and the
 * content region scrolling independently, so the document body never scrolls —
 * a header that slides away is the fastest way to make a dense tool feel cheap.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const isAdmin = ADMIN_ROLES.has(user.role);

  const [tree, unreadCount, workspaceMembers] = await Promise.all([
    getNavigationTree(user.id, isAdmin),
    getUnreadNotificationCount(user.id),
    getWorkspaceMembers(),
  ]);

  // A workspace admin can create a project anywhere; a team lead can create one
  // in a team they lead. Anyone who leads at least one visible team gets the
  // control, and createProject re-checks the specific team on submit.
  const leadsSomeTeam = await Promise.all(
    tree.teams.map((team) =>
      assertCan(user, { kind: "team.manage", teamId: team.id }),
    ),
  );
  const canCreateProject = leadsSomeTeam.some((result) => result.ok);

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar
        user={user}
        tree={tree}
        canInvite={isAdmin}
        canCreateProject={canCreateProject}
        workspaceMembers={workspaceMembers}
        unreadCount={unreadCount}
        signOutAction={signOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={user}
          tree={tree}
          unreadCount={unreadCount}
          signOutAction={signOut}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
