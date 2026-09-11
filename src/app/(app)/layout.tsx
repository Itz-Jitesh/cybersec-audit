import { signOut } from "@/actions/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/shared/footer";
import { getUnreadNotificationCount } from "@/db/queries/home";
import { getNavigationTree } from "@/db/queries/navigation";
import { getWorkspaceMembers } from "@/db/queries/project";
import { leadsAnyTeam, readsWholeWorkspace } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

/**
 * The authenticated shell. Fixed to the viewport with the sidebar and the
 * content region scrolling independently, so the document body never scrolls —
 * a header that slides away is the fastest way to make a dense tool feel cheap.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  // Admins and mentors read the whole workspace; everyone else sees the
  // teams they belong to.
  const seesEverything = readsWholeWorkspace(user.role);

  // A workspace admin can create a project anywhere; a team lead can create one
  // in a team they lead. This was one assertCan per team, so one query per
  // team on every page in the app; leadsAnyTeam answers it with a single row.
  // createProject re-checks the specific team on submit either way.
  const [tree, unreadCount, workspaceMembers, canCreateProject] =
    await Promise.all([
      getNavigationTree(user.id, seesEverything),
      getUnreadNotificationCount(user.id),
      getWorkspaceMembers(),
      leadsAnyTeam(user.id),
    ]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/*
        Rendered twice with the same props: once docked, once inside the
        drawer. Below 1024px the docked copy is hidden and the drawer is the
        only way to the navigation, which is what the responsive pass in
        docs/07-BUILD-PHASES.md phase 12 asks for.
      */}
      <div className="hidden lg:flex">
        <AppSidebar
          user={user}
          tree={tree}
          canCreateProject={canCreateProject}
          workspaceMembers={workspaceMembers}
          unreadCount={unreadCount}
        />
      </div>

      <MobileNav>
        <AppSidebar
          user={user}
          tree={tree}
          canCreateProject={canCreateProject}
          workspaceMembers={workspaceMembers}
          unreadCount={unreadCount}
          inDrawer
        />
      </MobileNav>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={user}
          tree={tree}
          unreadCount={unreadCount}
          signOutAction={signOut}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
