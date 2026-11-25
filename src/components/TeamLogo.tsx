"use client";
import { useState } from "react";
import { teamColor, teamTag } from "@/lib/format";

/** Logo officiel si connu, sinon monogramme aux couleurs générées. */
export function TeamLogo({ name, src, size = 44 }: { name: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} onError={() => setBroken(true)}
        className="shrink-0 object-contain" style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center font-display text-sm font-extrabold italic"
      style={{ width: size, height: size, background: teamColor(name) }} aria-hidden>
      {teamTag(name)}
    </span>
  );
}
