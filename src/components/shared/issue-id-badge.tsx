import { cn } from "@/lib/utils";

interface IssueIdBadgeProps {
  identifier: string;
  sequenceId: number;
  className?: string;
}

export function IssueIdBadge({
  identifier,
  sequenceId,
  className,
}: IssueIdBadgeProps) {
  return (
    <span
      className={cn(
        "font-mono text-xs whitespace-nowrap text-text-300 select-none",
        className,
      )}
    >
      {identifier}-{sequenceId}
    </span>
  );
}
