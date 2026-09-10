"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addTeamMember } from "@/actions/teams";
import {
  MemberPicker,
  type ProfileSummary,
} from "@/components/shared/member-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMemberRole } from "@/lib/validators/team";

/** "Added 3 members, 1 already in team" — one toast, whatever the mix. */
function summarise(added: number, already: number, failed: number): string {
  const parts: string[] = [];
  if (added > 0) parts.push(`Added ${added} ${added === 1 ? "member" : "members"}`);
  if (already > 0) parts.push(`${already} already in team`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(", ");
}

export function AddTeamMemberDialog({
  team,
  addableMembers,
}: {
  team: { id: string; name: string };
  addableMembers: ProfileSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState<TeamMemberRole>("member");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (selected.length === 0) return;
    setBusy(true);

    // One call per person rather than a bulk action: each insert is separately
    // authorised and separately auditable, and a single failure in the middle
    // must not discard the others.
    let added = 0;
    let already = 0;
    let failed = 0;
    for (const userId of selected) {
      const result = await addTeamMember({ teamId: team.id, userId, role });
      if (result.ok) added += 1;
      else if (result.code === "ALREADY_MEMBER") already += 1;
      else failed += 1;
    }

    setBusy(false);
    if (added === 0 && failed > 0) {
      toast.error(summarise(added, already, failed));
    } else {
      toast.success(summarise(added, already, failed));
    }

    setSelected([]);
    setRole("member");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={addableMembers.length === 0}>
          <Plus size={14} strokeWidth={1.5} />
          Add members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members to {team.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-text-300">People</Label>
            <MemberPicker
              members={addableMembers}
              value={selected}
              onChange={setSelected}
              multiple
              placeholder="Search workspace members"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-text-300">Role</Label>
            <Select
              value={role}
              onValueChange={(next) => setRole(next as TeamMemberRole)}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={busy || selected.length === 0}
          >
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
