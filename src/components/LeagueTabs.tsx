import Link from "next/link";
import { LEAGUES } from "@/lib/leagues";

export function LeagueTabs({ base, current, extra = {} }: { base: string; current?: string; extra?: Record<string, string> }) {
  const tabs = [{ code: "", label: "Toutes" }, ...LEAGUES.map((l) => ({ code: l.code, label: l.code }))];
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((t) => {
        const qs = new URLSearchParams({ ...extra, ...(t.code ? { ligue: t.code } : {}) }).toString();
        const active = (current ?? "") === t.code;
        return (
          <Link key={t.label} href={`${base}${qs ? `?${qs}` : ""}`}
            className={`h-display px-4 py-1.5 text-lg ${active ? "bg-white text-black" : "bg-wina-card text-wina-muted hover:text-white"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
