"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createTeam, deleteTeam, updateTeam } from "@/actions/teams";
import { ColorPicker } from "@/components/projects/color-picker";
import { InlineEditableText } from "@/components/shared/inline-editable-text";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PALETTE } from "@/lib/validators/project";

export interface AdminTeam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  projectCount: number;
}

/** Mirrors the slug rule in the validator, so the field previews what will be sent. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function TeamsAdmin({ teams }: { teams: AdminTeam[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [color, setColor] = useState<string>(PALETTE[9]);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  async function submit() {
    setBusy(true);
    const result = await createTeam({
      name,
      slug: slugTouched ? slug : slugify(name),
      color,
      description: "",
      logoEmoji: "",
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${name} created.`);
    setOpen(false);
    setName("");
    setSlug("");
    setSlugTouched(false);
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-200">Teams</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus size={14} strokeWidth={1.5} />
          New team
        </Button>
      </div>

      <ul className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
        {teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center gap-3 border-b border-border-subtle px-3 py-2.5 last:border-b-0"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <span className="min-w-0 flex-1 text-sm text-text-100">
              <InlineEditableText
                value={team.name}
                onSave={async (next) => {
                  const result = await updateTeam({
                    teamId: team.id,
                    name: next,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  router.refresh();
                }}
              />
            </span>
            <span className="font-mono text-xs text-text-400">{team.slug}</span>
            <span className="w-24 text-right text-xs text-text-300">
              {team.projectCount}{" "}
              {team.projectCount === 1 ? "project" : "projects"}
            </span>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label={`Delete ${team.name}`}
                  className="rounded-sm p-1 text-text-400 transition-colors duration-[120ms] ease-out hover:bg-bg-70 hover:text-danger"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {team.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {team.projectCount > 0
                      ? "This team still has projects. Move or delete them first — the action will refuse otherwise."
                      : "The team and its membership list are removed. This cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div>
                  <p className="text-xs text-text-300">
                    Type{" "}
                    <span className="font-medium text-text-100">
                      {team.name}
                    </span>{" "}
                    to confirm.
                  </p>
                  <Input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="mt-1.5"
                    aria-label="Team name confirmation"
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmation("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmation !== team.name}
                    onClick={async () => {
                      const result = await deleteTeam({
                        teamId: team.id,
                        confirmation,
                      });
                      setConfirmation("");
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(`${team.name} deleted.`);
                      router.refresh();
                    }}
                  >
                    Delete team
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="team-name" className="text-xs">
                Name
              </Label>
              <Input
                id="team-name"
                autoFocus
                value={name}
                placeholder="Research"
                className="mt-1"
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="team-slug" className="text-xs">
                Slug
              </Label>
              <Input
                id="team-slug"
                value={slugTouched ? slug : slugify(name)}
                className="mt-1 font-mono"
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
              />
              <p className="mt-1 text-xs text-text-400">
                Used in the team&rsquo;s address, as in /teams/
                {slugTouched ? slug || "slug" : slugify(name) || "slug"}.
              </p>
            </div>

            <div>
              <Label className="text-xs">Colour</Label>
              <div className="mt-1.5">
                <ColorPicker
                  label="Team colour"
                  value={color}
                  onChange={setColor}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy || name.trim().length < 2}
              onClick={submit}
            >
              {busy ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
