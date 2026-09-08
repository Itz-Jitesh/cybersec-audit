"use client";

import { Star } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { toggleFavorite } from "@/actions/favorites";
import { cn } from "@/lib/utils";
import type { FavoriteEntity } from "@/lib/validators/favorite";

interface FavoriteStarProps {
  entityType: FavoriteEntity;
  entityId: string;
  isFavorite: boolean;
  label: string;
}

export function FavoriteStar({
  entityType,
  entityId,
  isFavorite,
  label,
}: FavoriteStarProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Unstar ${label}` : `Star ${label}`}
      onClick={(event) => {
        // The star usually sits inside a card that is itself a link.
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          const result = await toggleFavorite({ entityType, entityId });
          if (!result.ok) toast.error(result.error);
        });
      }}
      className={cn(
        "rounded-sm p-1 transition-colors duration-[120ms] ease-out",
        isFavorite
          ? "text-warning"
          : "text-text-400 hover:bg-bg-70 hover:text-text-200",
      )}
    >
      <Star
        size={14}
        strokeWidth={1.5}
        className={isFavorite ? "fill-current" : undefined}
      />
    </button>
  );
}
