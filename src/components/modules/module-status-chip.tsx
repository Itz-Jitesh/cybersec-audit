import type { ModuleStatus } from "@/lib/validators/module";

/**
 * The module status chip. Colours resolve through the semantic tokens rather
 * than literals, so the phase-13 reskin reaches these with everything else.
 */
const LABELS: Record<ModuleStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TONES: Record<ModuleStatus, string> = {
  planned: "bg-bg-80 text-text-300",
  in_progress: "bg-brand-subtle text-brand",
  paused: "bg-bg-80 text-warning",
  completed: "bg-bg-80 text-success",
  cancelled: "bg-bg-80 text-danger",
};

export function ModuleStatusChip({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-2xs font-medium ${TONES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
