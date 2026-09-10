import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";

import { MemberAvatar } from "@/components/shared/member-avatar";
import { getAuditLog } from "@/db/queries/admin";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

const PAGE_SIZE = 100;

const ACTION_TEXT: Record<string, string> = {
  "invite.sent": "sent an invite",
  "invite.revoked": "revoked an invite",
  "invite.resent": "resent an invite",
  "member.role_changed": "changed a role",
  "member.deactivated": "deactivated a member",
  "member.reactivated": "reactivated a member",
  "project.deleted": "deleted a project",
  "team.deleted": "deleted a team",
};

/** Reads the metadata jsonb into a one-line summary without trusting its shape. */
function describe(metadata: unknown): string {
  if (typeof metadata !== "object" || metadata === null) return "";
  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["email", "name", "from", "to"]) {
    const value = record[key];
    if (typeof value === "string") parts.push(`${key}: ${value}`);
  }
  return parts.join(" · ");
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) notFound();

  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number(page ?? "1") || 1);
  const entries = await getAuditLog(PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE);

  return (
    <div>
      <h1 className="text-sm font-medium text-text-100">Audit log</h1>
      <p className="mt-0.5 text-xs text-text-400">
        Append-only. Invites, role changes, deactivations and deletions.
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-md border border-border-subtle px-3 py-6 text-center text-xs text-text-400">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-md border border-border-subtle">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2 last:border-b-0"
            >
              <MemberAvatar
                user={{
                  id: entry.id,
                  displayName: entry.actorName,
                  avatarUrl: entry.actorAvatarUrl,
                }}
                size={20}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-100">
                  <span className="font-medium">{entry.actorName}</span>{" "}
                  {ACTION_TEXT[entry.action] ?? entry.action}
                </p>
                <p className="truncate text-2xs text-text-400">
                  {describe(entry.metadata)}
                </p>
              </div>
              <span className="shrink-0 text-2xs text-text-400">
                {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(pageNumber > 1 || entries.length === PAGE_SIZE) && (
        <div className="mt-3 flex justify-between text-xs text-text-300">
          {pageNumber > 1 ? (
            <a href={`/admin/audit?page=${pageNumber - 1}`}>Newer</a>
          ) : (
            <span />
          )}
          {entries.length === PAGE_SIZE && (
            <a href={`/admin/audit?page=${pageNumber + 1}`}>Older</a>
          )}
        </div>
      )}
    </div>
  );
}
