import { ShieldAlert } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

/**
 * One guard for every admin section.
 *
 * Each page still asserts for itself — a layout guard is not authorization,
 * because a page can be rendered without it in a future refactor — but putting
 * it here means the refusal notice is written once rather than five times.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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

  return (
    <div className="mx-auto flex w-full max-w-[1100px] gap-8 px-6 pt-4 pb-10">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
