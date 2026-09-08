import { cn } from "@/lib/utils";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

interface PriorityIconProps {
  priority: IssuePriority;
  size?: 14 | 16 | 18;
  className?: string;
}

/**
 * Signal-bar priority glyph. Low fills one bar, medium two, high three, none
 * renders three empty bars. Urgent breaks the pattern with a filled square, so
 * it reads as a different class of thing at a glance rather than as "one more
 * bar than high".
 */
const FILLED_BARS: Record<Exclude<IssuePriority, "urgent">, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const COLOR_CLASS: Record<IssuePriority, string> = {
  urgent: "text-priority-urgent",
  high: "text-priority-high",
  medium: "text-priority-medium",
  low: "text-priority-low",
  none: "text-priority-none",
};

const BARS = [
  { x: 2, y: 9.5, height: 4.5 },
  { x: 6.5, y: 6.5, height: 7.5 },
  { x: 11, y: 3.5, height: 10.5 },
];

export function PriorityIcon({
  priority,
  size = 16,
  className,
}: PriorityIconProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    "aria-hidden": true as const,
    className: cn("shrink-0", COLOR_CLASS[priority], className),
  };

  if (priority === "urgent") {
    return (
      <svg {...shared}>
        <rect
          x="1.5"
          y="1.5"
          width="13"
          height="13"
          rx="3"
          fill="currentColor"
        />
        <rect
          x="7.25"
          y="4"
          width="1.5"
          height="5"
          rx="0.75"
          className="fill-on-brand"
        />
        <rect
          x="7.25"
          y="10.5"
          width="1.5"
          height="1.5"
          rx="0.75"
          className="fill-on-brand"
        />
      </svg>
    );
  }

  const filled = FILLED_BARS[priority];

  return (
    <svg {...shared}>
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="3"
          height={bar.height}
          rx="1"
          fill={index < filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.25"
          opacity={index < filled ? 1 : 0.5}
        />
      ))}
    </svg>
  );
}
