import { format, isPast, isThisYear, startOfDay } from "date-fns";

import { cn } from "@/lib/utils";

interface DateChipProps {
  date: Date | string;
  variant?: "start" | "target";
  isCompleted?: boolean;
  className?: string;
}

/**
 * A target date in the past on an issue that is not finished is the only case
 * that earns a colour here. Everything else stays quiet metadata.
 */
export function DateChip({
  date,
  variant = "target",
  isCompleted = false,
  className,
}: DateChipProps) {
  const value = typeof date === "string" ? new Date(date) : date;
  const label = format(value, isThisYear(value) ? "MMM d" : "MMM d, yyyy");
  const isOverdue =
    variant === "target" && !isCompleted && isPast(startOfDay(value));

  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded-sm px-1.5 text-xs",
        isOverdue ? "bg-danger/12 text-danger" : "text-text-300",
        className,
      )}
    >
      {label}
    </span>
  );
}
