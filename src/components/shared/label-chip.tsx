"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface IssueLabel {
  id: string;
  name: string;
  color: string;
}

interface LabelChipProps {
  label: IssueLabel;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

/**
 * Label colours come from the database, so this is one of the two components
 * permitted to set colour through an inline style. The chip renders the colour
 * at low alpha for the fill and a slightly stronger alpha for the border, which
 * keeps a saturated user-chosen colour from shouting over the row it sits in.
 */
export function LabelChip({
  label,
  removable = false,
  onRemove,
  className,
}: LabelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center gap-1.5 rounded-full border px-1.5 text-xs text-text-200",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${label.color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${label.color} 30%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
      />
      {label.name}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove label ${label.name}`}
          className="-mr-0.5 text-text-300 transition-colors duration-[120ms] ease-out hover:text-text-100"
        >
          <X size={10} strokeWidth={1.5} />
        </button>
      )}
    </span>
  );
}
