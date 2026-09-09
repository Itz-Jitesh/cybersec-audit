import { notFound } from "next/navigation";

import { MembersAdmin } from "@/components/admin/members-admin";
import { getAdminMembers } from "@/db/queries/admin";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function AdminMembersPage() {
  const user = await requireUser();
  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) notFound();

  const members = await getAdminMembers();

  return (
    <div>
      <h1 className="text-sm font-medium text-text-100">Members</h1>
      <p className="mt-0.5 text-xs text-text-400">
        {members.length} in the workspace. Role changes and deactivations are
        written to the audit log.
      </p>
      <MembersAdmin members={members} currentUserId={user.id} />
    </div>
  );
}
