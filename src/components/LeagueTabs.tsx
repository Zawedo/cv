import Link from "next/link";
import { LEAGUES } from "@/lib/leagues";

export function LeagueTabs({ base, current, extra = {} }: { base: string; current?: string; extra?: Record<string, string> }) {
  const tabs = [{ code: "", label: "Toutes" }, ...LEAGUES.map((l) => ({ code: l.code, label: l.code }))];
  return (
    <div className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {tabs.map((t) => {
        const qs = new URLSearchParams({ ...extra, ...(t.code ? { ligue: t.code } : {}) }).toString();
        const active = (current ?? "") === t.code;
        return (
          <Link key={t.label} href={`${base}${qs ? `?${qs}` : ""}`}
            className={`h-display flex-1 shrink-0 px-3.5 py-1.5 text-center text-lg sm:flex-none sm:px-4 ${active ? "bg-white text-black" : "bg-wina-card text-wina-muted hover:text-white"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
