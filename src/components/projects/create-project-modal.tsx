"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createProject, isIdentifierAvailable } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MemberRow } from "@/db/queries/project";
import {
  type CreateProjectInput,
  createProjectSchema,
  suggestIdentifier,
} from "@/lib/validators/project";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: { id: string; name: string }[];
  members: MemberRow[];
  defaultTeamId?: string;
}

type Availability = "idle" | "checking" | "free" | "taken";

export function CreateProjectModal({
  open,
  onOpenChange,
  teams,
  members,
  defaultTeamId,
}: CreateProjectModalProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Availability>("idle");
  // Once the identifier is edited by hand it stops tracking the name, because
  // silently overwriting someone's deliberate choice is worse than a stale
  // suggestion.
  const identifierTouched = useRef(false);

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      identifier: "",
      teamId: defaultTeamId ?? "",
      leadId: "",
      iconEmoji: "",
      description: "",
    },
  });

  const name = form.watch("name");
  const identifier = form.watch("identifier");

  useEffect(() => {
    if (identifierTouched.current) return;
    form.setValue("identifier", suggestIdentifier(name), {
      shouldValidate: false,
    });
  }, [name, form]);

  // Debounced so typing five characters is one lookup, not five.
  useEffect(() => {
    if (!/^[A-Z]{2,5}$/.test(identifier)) {
      setAvailability("idle");
      return;
    }

    setAvailability("checking");
    const timer = setTimeout(async () => {
      const result = await isIdentifierAvailable(identifier);
      setAvailability(
        result.ok ? (result.data.available ? "free" : "taken") : "idle",
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [identifier]);

  async function onSubmit(values: CreateProjectInput) {
    const result = await createProject(values);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${values.name} created.`);
    onOpenChange(false);
    form.reset();
    identifierTouched.current = false;
    router.push(`/projects/${result.data.id}/issues`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Six default states and seven labels are created with it.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex gap-3">
            <div className="w-16">
              <Label htmlFor="iconEmoji" className="text-xs">
                Icon
              </Label>
              <Input
                id="iconEmoji"
                maxLength={2}
                placeholder="🛡"
                className="mt-1 text-center"
                {...form.register("iconEmoji")}
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="name" className="text-xs">
                Name
              </Label>
              <Input
                id="name"
                autoFocus
                placeholder="CTF Platform"
                className="mt-1"
                {...form.register("name")}
              />
            </div>
          </div>
          {form.formState.errors.name && (
            <p className="text-xs text-danger">
              {form.formState.errors.name.message}
            </p>
          )}

          <div>
            <Label htmlFor="identifier" className="text-xs">
              Identifier
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="identifier"
                maxLength={5}
                className="w-28 font-mono uppercase"
                {...form.register("identifier", {
                  onChange: () => {
                    identifierTouched.current = true;
                  },
                })}
              />
              {availability === "checking" && (
                <Loader2
                  size={14}
                  className="animate-spin text-text-400"
                  aria-label="Checking availability"
                />
              )}
              {availability === "free" && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check size={12} /> Available
                </span>
              )}
              {availability === "taken" && (
                <span className="flex items-center gap-1 text-xs text-danger">
                  <X size={12} /> Already used
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-text-400">
              Prefixes every issue id in this project, as in{" "}
              <span className="font-mono">{identifier || "CTF"}-142</span>. Two
              to five letters.
            </p>
            {form.formState.errors.identifier && (
              <p className="mt-1 text-xs text-danger">
                {form.formState.errors.identifier.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Team</Label>
              <Select
                defaultValue={defaultTeamId}
                onValueChange={(value) =>
                  form.setValue("teamId", value, { shouldValidate: true })
                }
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.teamId && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.teamId.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Lead</Label>
              <Select onValueChange={(value) => form.setValue("leadId", value)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="What is this project for?"
              className="mt-1"
              {...form.register("description")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting || availability === "taken"}
            >
              {form.formState.isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
