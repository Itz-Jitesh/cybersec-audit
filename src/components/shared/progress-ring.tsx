import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  total: number;
  size?: 20 | 32 | 48;
  showLabel?: boolean;
  className?: string;
}

const STROKE: Record<20 | 32 | 48, number> = { 20: 2.5, 32: 3.5, 48: 5 };
const LABEL_SIZE: Record<20 | 32 | 48, string> = {
  20: "text-2xs",
  32: "text-2xs",
  48: "text-xs",
};

export function ProgressRing({
  value,
  total,
  size = 32,
  showLabel = false,
  className,
}: ProgressRingProps) {
  const ratio = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  const percent = Math.round(ratio * 100);
  const strokeWidth = STROKE[size];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${value} of ${total} complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-bg-70"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          className="stroke-success transition-[stroke-dasharray] duration-[160ms] ease-out"
        />
      </svg>

      {showLabel && (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-medium text-text-200",
            LABEL_SIZE[size],
          )}
        >
          {percent}
        </span>
      )}
    </div>
  );
}
