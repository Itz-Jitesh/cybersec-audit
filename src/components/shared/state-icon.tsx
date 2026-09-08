import { cn } from "@/lib/utils";

export type StateGroup =
  "backlog" | "unstarted" | "started" | "completed" | "cancelled";

interface StateIconProps {
  group: StateGroup;
  /** Overrides the group's default colour. Comes from states.color in the database. */
  color?: string;
  size?: number;
  className?: string;
}

const COLOR_CLASS: Record<StateGroup, string> = {
  backlog: "text-state-backlog",
  unstarted: "text-state-unstarted",
  started: "text-state-started",
  completed: "text-state-completed",
  cancelled: "text-state-cancelled",
};

export function StateIcon({
  group,
  color,
  size = 14,
  className,
}: StateIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("shrink-0", !color && COLOR_CLASS[group], className)}
      // Dynamic colour sourced from the database, which is the one case where
      // an inline style is permitted.
      style={color ? { color } : undefined}
    >
      {group === "backlog" && (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2.2 2.2"
        />
      )}

      {group === "unstarted" && (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}

      {group === "started" && (
        <>
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {/* Half-filled arc, clockwise from twelve to six o'clock. */}
          <path d="M8 3.5 A4.5 4.5 0 0 1 8 12.5 Z" fill="currentColor" />
        </>
      )}

      {group === "completed" && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="M5.25 8.25 L7.1 10.1 L10.75 6"
            fill="none"
            className="stroke-on-brand"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {group === "cancelled" && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5"
            fill="none"
            className="stroke-on-brand"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
