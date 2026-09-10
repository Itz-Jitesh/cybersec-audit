"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { removeTeamMember, setTeamRole } from "@/actions/teams";
import { AddTeamMemberDialog } from "@/components/admin/add-team-member-dialog";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { ProfileSummary } from "@/components/shared/member-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMemberProfile } from "@/db/queries/teams";
import type { TeamMemberRole } from "@/lib/validators/team";

type Patch =
  | { kind: "role"; userId: string; role: TeamMemberRole }
  | { kind: "remove"; userId: string };

/**
 * The team roster with its management controls.
 *
 * `canManage` removes the controls rather than disabling them. A disabled
 * control still tells a plain member that a role dropdown exists and invites
 * them to hunt for the enabled version; the server refuses either way, so the
 * only question is what the UI implies.
 *
 * Optimism here is useOptimistic rather than the TanStack contract in
 * docs/03-TRD.md §3.1: this roster is server-rendered props, not query cache,
 * so there is no cache to snapshot. The revert is React's — when the
 * transition ends the props are authoritative again, which is exactly the
 * rollback the contract asks for.
 */
export function TeamMembersPanel({
  team,
  members,
  addableMembers,
  canManage,
}: {
  team: { id: string; name: string };
  members: TeamMemberProfile[];
  addableMembers: ProfileSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visible, applyPatch] = useOptimistic(
    members,
    (state: TeamMemberProfile[], patch: Patch) =>
      patch.kind === "remove"
        ? state.filter((member) => member.userId !== patch.userId)
        : state.map((member) =>
            member.userId === patch.userId
              ? { ...member, role: patch.role }
              : member,
          ),
  );

  function onRole(member: TeamMemberProfile, role: TeamMemberRole) {
    startTransition(async () => {
      applyPatch({ kind: "role", userId: member.userId, role });
      const result = await setTeamRole({
        teamId: team.id,
        userId: member.userId,
        role,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        role === "lead"
          ? `${member.displayName} is now a lead.`
          : `${member.displayName} is now a member.`,
      );
      router.refresh();
    });
  }

  function onRemove(member: TeamMemberProfile) {
    startTransition(async () => {
      applyPatch({ kind: "remove", userId: member.userId });
      const result = await removeTeamMember({
        teamId: team.id,
        userId: member.userId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.displayName} removed from ${team.name}.`);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-400">
          {visible.length === 1 ? "1 member" : `${visible.length} members`}
        </p>
        {canManage && (
          <AddTeamMemberDialog team={team} addableMembers={addableMembers} />
        )}
      </div>

      <div className="mt-2 overflow-hidden rounded-md border border-border-subtle">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-xs text-text-400">
            Nobody has been added to this team yet.
          </p>
        ) : (
          visible.map((member) => (
            <div
              key={member.userId}
              className="flex h-10 items-center gap-3 border-b border-border-subtle px-3 last:border-b-0"
            >
              <MemberAvatar
                user={{
                  id: member.userId,
                  displayName: member.displayName,
                  avatarUrl: member.avatarUrl,
                }}
                size={24}
              />
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-sm text-text-100">
                  {member.displayName}
                </span>
                <span className="truncate text-xs text-text-300">
                  {member.email}
                </span>
              </div>

              {canManage ? (
                <>
                  <Select
                    value={member.role}
                    disabled={pending}
                    onValueChange={(next) =>
                      onRole(member, next as TeamMemberRole)
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={`Team role for ${member.displayName}`}
                      className="w-28"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Remove ${member.displayName} from ${team.name}`}
                        className="flex size-7 items-center justify-center rounded-sm text-text-400 hover:bg-bg-70 hover:text-danger"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Remove {member.displayName} from {team.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          They lose access to every project this team owns.
                          Their issues, comments and assignments stay where they
                          are.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemove(member)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <span className="text-xs text-text-400 capitalize">
                  {member.role}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
