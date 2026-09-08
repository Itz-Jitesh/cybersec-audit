import { cn } from "@/lib/utils";

interface KbdProps {
  keys: string[];
  className?: string;
}

export function Kbd({ keys, className }: KbdProps) {
  return (
    <span className={cn("inline-flex gap-0.5", className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] bg-bg-70 px-1 font-mono text-2xs font-medium text-text-300"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
