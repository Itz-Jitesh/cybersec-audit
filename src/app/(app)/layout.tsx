import { signOut } from "@/actions/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { getUnreadNotificationCount } from "@/db/queries/home";
import { getNavigationTree } from "@/db/queries/navigation";
import { getWorkspaceMembers } from "@/db/queries/project";
import { leadsAnyTeam } from "@/lib/auth/permissions";
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

  // A workspace admin can create a project anywhere; a team lead can create one
  // in a team they lead. This was one assertCan per team, so one query per
  // team on every page in the app; leadsAnyTeam answers it with a single row.
  // createProject re-checks the specific team on submit either way.
  const [tree, unreadCount, workspaceMembers, canCreateProject] =
    await Promise.all([
      getNavigationTree(user.id, isAdmin),
      getUnreadNotificationCount(user.id),
      getWorkspaceMembers(),
      leadsAnyTeam(user.id),
    ]);

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
