import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

/**
 * Stands in for a route whose content belongs to a later phase. It exists so
 * the information architecture is navigable now and so every link in the
 * sidebar leads somewhere honest rather than to a 404.
 */
export function PlaceholderPage({
  icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-4">
      <h1 className="text-xl font-semibold text-text-100">{title}</h1>
      <div className="mt-4 rounded-lg border border-border-subtle">
        <EmptyState
          icon={icon}
          title={description}
          description={`Built in ${phase}.`}
        />
      </div>
    </div>
  );
}
