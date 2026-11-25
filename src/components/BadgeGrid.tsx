import type { Badge } from "@/lib/badges";

const TIER = { bronze: "#C08457", argent: "#C9CED6", or: "#F5C400" } as const;

export function BadgeGrid({ badges, own }: { badges: Badge[]; own: boolean }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="h-display text-2xl">Badges</h2>
        <span className="text-sm text-wina-muted">{earned}/{badges.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {badges.map((b) => (
          <div key={b.id} title={b.desc}
            className={`card relative flex min-w-0 items-start gap-3 p-3 ${b.earned ? "" : "opacity-45"}`}
            style={b.earned ? { borderColor: TIER[b.tier] } : undefined}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center text-xl ${b.earned ? "" : "grayscale"}`}
              style={{ background: b.earned ? `${TIER[b.tier]}22` : "#00000040" }} aria-hidden>{b.icon}</span>
            <div className="min-w-0">
              <div className="h-display truncate text-base leading-tight">{b.name}</div>
              <div className="text-[11px] leading-snug text-wina-muted">{b.detail ?? b.desc}</div>
              {!b.earned && b.progress && b.progress[1] > 1 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1 flex-1 bg-wina-line"><span className="block h-full bg-wina-red" style={{ width: `${(b.progress[0] / b.progress[1]) * 100}%` }} /></span>
                  <span className="text-[10px] text-wina-muted">{b.progress[0]}/{b.progress[1]}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {own && earned === 0 && <p className="mt-2 text-xs text-wina-muted">Ton premier badge arrive avec ton premier prono.</p>}
    </section>
  );
}
