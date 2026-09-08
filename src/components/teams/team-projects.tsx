"use client";

import { Box, Plus } from "lucide-react";
import { useState } from "react";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { MemberRow, TeamProjectCard } from "@/db/queries/project";

interface TeamProjectsProps {
  teamId: string;
  teamName: string;
  projects: TeamProjectCard[];
  teams: { id: string; name: string }[];
  members: MemberRow[];
  /** Mirrors the server-side guard; the action re-checks it regardless. */
  canCreate: boolean;
}

export function TeamProjects({
  teamId,
  teamName,
  projects,
  teams,
  members,
  canCreate,
}: TeamProjectsProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-200">Projects</h2>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus size={14} strokeWidth={1.5} />
            New project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="mt-3 rounded-lg border border-border-subtle">
          <EmptyState
            icon={Box}
            title={`${teamName} has no projects yet`}
            description={
              canCreate
                ? "A project holds its own issues, cycles and workflow states."
                : "A team lead or a workspace admin can create the first one."
            }
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setOpen(true)}>
                  Create project
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectModal
        open={open}
        onOpenChange={setOpen}
        teams={teams}
        members={members}
        defaultTeamId={teamId}
      />
    </section>
  );
}
