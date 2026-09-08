"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { setProjectRole, updateProject } from "@/actions/projects";
import { DangerZone } from "@/components/projects/danger-zone";
import {
  type EditableLabel,
  LabelsEditor,
} from "@/components/projects/labels-editor";
import {
  type EditableState,
  StatesEditor,
} from "@/components/projects/states-editor";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { MemberRow, ProjectSummary } from "@/db/queries/project";

interface ProjectSettingsProps {
  project: ProjectSummary;
  members: MemberRow[];
  states: EditableState[];
  labels: EditableLabel[];
  canDelete: boolean;
}

export function ProjectSettings({
  project,
  members,
  states,
  labels,
  canDelete,
}: ProjectSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [iconEmoji, setIconEmoji] = useState(project.iconEmoji ?? "");
  const [saving, setSaving] = useState(false);

  const refresh = () => router.refresh();

  async function saveGeneral() {
    setSaving(true);
    const result = await updateProject({
      projectId: project.id,
      name,
      description,
      iconEmoji,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Project updated.");
    refresh();
  }

  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="states">States</TabsTrigger>
        <TabsTrigger value="labels">Labels</TabsTrigger>
        <TabsTrigger value="danger">Danger zone</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="mt-4 max-w-[560px]">
        <div className="flex gap-3">
          <div className="w-16">
            <Label htmlFor="icon" className="text-xs">
              Icon
            </Label>
            <Input
              id="icon"
              maxLength={2}
              value={iconEmoji}
              onChange={(event) => setIconEmoji(event.target.value)}
              className="mt-1 text-center"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="name" className="text-xs">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="identifier" className="text-xs">
            Identifier
          </Label>
          <Input
            id="identifier"
            value={project.identifier}
            disabled
            className="mt-1 w-28 font-mono"
          />
          <p className="mt-1 text-xs text-text-400">
            Fixed once the project exists. Changing it would rewrite the id of
            every issue that has already been shared or linked.
          </p>
        </div>

        <div className="mt-3">
          <Label htmlFor="description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1"
          />
        </div>

        <Button
          size="sm"
          className="mt-4"
          disabled={saving}
          onClick={saveGeneral}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </TabsContent>

      <TabsContent value="members" className="mt-4 max-w-[560px]">
        <ul className="overflow-hidden rounded-lg border border-border-subtle">
          {members.map((member) => (
            <li
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
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-100">
                  {member.displayName}
                </span>
                <span className="block truncate text-xs text-text-400">
                  {member.email}
                </span>
              </span>
              <Select
                value={member.role}
                onValueChange={async (role) => {
                  const result = await setProjectRole({
                    projectId: project.id,
                    userId: member.userId,
                    role,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  refresh();
                }}
              >
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-text-400">
          Everyone in {project.teamName} can already see this project. Adding
          someone here gives them a role in it specifically.
        </p>
      </TabsContent>

      <TabsContent value="states" className="mt-4 max-w-[720px]">
        <p className="mb-3 text-xs text-text-300">
          Drag to reorder. The starred state is the one new issues start in, and
          the group decides how an issue counts towards progress.
        </p>
        <StatesEditor
          projectId={project.id}
          states={states}
          onRefresh={refresh}
        />
      </TabsContent>

      <TabsContent value="labels" className="mt-4 max-w-[720px]">
        <LabelsEditor
          projectId={project.id}
          labels={labels}
          onRefresh={refresh}
        />
      </TabsContent>

      <TabsContent value="danger" className="mt-4 max-w-[720px]">
        <DangerZone
          projectId={project.id}
          projectName={project.name}
          canDelete={canDelete}
        />
      </TabsContent>
    </Tabs>
  );
}
