"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PALETTE } from "@/lib/validators/project";

/**
 * A fixed twelve-colour palette rather than a free colour input. Every one of
 * these reads correctly on the dark surfaces, which an arbitrary hex would not,
 * and a constrained set keeps a workspace's states and labels looking related.
 */
export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
    >
      {PALETTE.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-5 items-center justify-center rounded-full",
              selected &&
                "ring-1 ring-border-focus ring-offset-2 ring-offset-[var(--bg-90)]",
            )}
            style={{ backgroundColor: color }}
          >
            {selected && <Check size={12} className="text-on-brand" />}
          </button>
        );
      })}
    </div>
  );
}
