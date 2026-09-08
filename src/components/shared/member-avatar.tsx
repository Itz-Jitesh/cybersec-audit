import { cn } from "@/lib/utils";

export interface MemberAvatarUser {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export type AvatarSize = 16 | 20 | 24 | 28;

interface MemberAvatarProps {
  user: MemberAvatarUser;
  size?: AvatarSize;
  className?: string;
}

/**
 * Eight fallback backgrounds, all drawn from existing tokens so a reskin moves
 * the avatars with everything else.
 */
const FALLBACK_COLORS = [
  "bg-brand",
  "bg-success",
  "bg-warning",
  "bg-danger",
  "bg-info",
  "bg-priority-high",
  "bg-priority-medium",
  "bg-priority-none",
] as const;

const TEXT_SIZE: Record<AvatarSize, string> = {
  16: "text-2xs",
  20: "text-2xs",
  24: "text-xs",
  28: "text-xs",
};

/**
 * FNV-1a. Pure and deterministic, so the colour a user gets on the server
 * matches the one the client renders and there is no hydration mismatch.
 */
export function hashUserId(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function avatarColorClass(id: string): string {
  return FALLBACK_COLORS[hashUserId(id) % FALLBACK_COLORS.length];
}

export function MemberAvatar({
  user,
  size = 20,
  className,
}: MemberAvatarProps) {
  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none",
    className,
  );

  if (user.avatarUrl) {
    return (
      // The avatar host is user-controlled Supabase Storage, so this stays a
      // plain img rather than next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        width={size}
        height={size}
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <span
      title={user.displayName}
      style={{ width: size, height: size }}
      className={cn(
        base,
        avatarColorClass(user.id),
        TEXT_SIZE[size],
        "font-medium text-on-brand",
      )}
    >
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  );
}
