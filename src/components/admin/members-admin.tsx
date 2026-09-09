"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { changeMemberRole, setMemberActive } from "@/actions/members";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminMember } from "@/db/queries/admin";
import type { WorkspaceRole } from "@/lib/validators/admin";

/**
 * The member table.
 *
 * A member's own row is rendered read-only: the action refuses self-edits and
 * so does the policy, so offering the control would only produce an error the
 * person cannot act on.
 */
export function MembersAdmin({
  members,
  currentUserId,
}: {
  members: AdminMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onRole(userId: string, role: string) {
    startTransition(async () => {
      const result = await changeMemberRole({
        userId,
        role: role as WorkspaceRole,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not change that role.");
        return;
      }
      toast.success("Role updated.");
      router.refresh();
    });
  }

  function onActive(userId: string, isActive: boolean) {
    startTransition(async () => {
      const result = await setMemberActive({ userId, isActive });
      if (!result.ok) {
        toast.error(result.error ?? "Could not change that member.");
        return;
      }
      toast.success(isActive ? "Member reactivated." : "Member deactivated.");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border-subtle">
      {members.map((member) => {
        const isSelf = member.userId === currentUserId;
        return (
          <div
            key={member.userId}
            className="flex items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0"
          >
            <MemberAvatar
              user={{
                id: member.userId,
                displayName: member.displayName,
                avatarUrl: member.avatarUrl,
              }}
              size={24}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-text-100">
                {member.displayName}
                {isSelf && <span className="text-text-400"> · you</span>}
              </p>
              <p className="truncate text-2xs text-text-400">
                {member.email}
                {member.teams.length > 0 && (
                  <>
                    {" · "}
                    {member.teams
                      .map((team) =>
                        team.role === "lead" ? `${team.name} (lead)` : team.name,
                      )
                      .join(", ")}
                  </>
                )}
              </p>
            </div>

            {!member.isActive && (
              <span className="rounded-full bg-bg-80 px-1.5 py-0.5 text-2xs text-danger">
                Deactivated
              </span>
            )}

            {isSelf ? (
              <span className="w-36 text-right text-2xs text-text-400 capitalize">
                {member.role.replace("_", " ")}
              </span>
            ) : (
              <>
                <Select
                  value={member.role}
                  disabled={pending}
                  onValueChange={(next) => onRole(member.userId, next)}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Role for ${member.displayName}`}
                    className="w-36"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="co_president">Co-president</SelectItem>
                    <SelectItem value="president">President</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => onActive(member.userId, !member.isActive)}
                >
                  {member.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
