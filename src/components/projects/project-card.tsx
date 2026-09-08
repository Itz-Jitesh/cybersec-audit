import Link from "next/link";

import { FavoriteStar } from "@/components/projects/favorite-star";
import type { TeamProjectCard } from "@/db/queries/project";

export function ProjectCard({ project }: { project: TeamProjectCard }) {
  return (
    <Link
      href={`/projects/${project.id}/issues`}
      className="group flex flex-col rounded-lg border border-border-subtle bg-bg-90 px-4 py-3 transition-colors duration-[120ms] ease-out hover:border-border-strong"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-base leading-5">
          {project.iconEmoji ?? "📁"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-100">
            {project.name}
          </span>
          <span className="block font-mono text-xs text-text-400">
            {project.identifier}
          </span>
        </span>
        <FavoriteStar
          entityType="project"
          entityId={project.id}
          isFavorite={project.isFavorite}
          label={project.name}
        />
      </div>

      {project.description && (
        <p className="mt-2 line-clamp-2 text-xs text-text-300">
          {project.description}
        </p>
      )}
    </Link>
  );
}
