import {
  type AvatarSize,
  MemberAvatar,
  type MemberAvatarUser,
} from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";

interface AvatarGroupProps {
  users: MemberAvatarUser[];
  max?: number;
  size?: Extract<AvatarSize, 16 | 20 | 24>;
  className?: string;
}

const TEXT_SIZE: Record<16 | 20 | 24, string> = {
  16: "text-2xs",
  20: "text-2xs",
  24: "text-xs",
};

export function AvatarGroup({
  users,
  max = 3,
  size = 20,
  className,
}: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((user, index) => (
        <div
          key={user.id}
          className={cn(
            "rounded-full ring-1 ring-bg-90",
            index > 0 && "-ml-1.5",
          )}
        >
          <MemberAvatar user={user} size={size} />
        </div>
      ))}

      {overflow > 0 && (
        <span
          style={{ width: size, height: size }}
          className={cn(
            "-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-bg-70 font-medium text-text-300 ring-1 ring-bg-90",
            TEXT_SIZE[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
