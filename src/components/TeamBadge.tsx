import { teamColor, teamTag } from "@/lib/format";

export function TeamBadge({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-display text-sm font-extrabold italic"
      style={{ width: size, height: size, background: teamColor(name) }}
      aria-hidden
    >
      {teamTag(name)}
    </span>
  );
}
