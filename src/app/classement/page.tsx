import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isLeagueCode } from "@/lib/leagues";
import { leaderboard } from "@/lib/queries";
import { parsePeriod, periodOf, shiftPeriod, type PeriodKind } from "@/lib/periods";
import { Shell, PageTitle } from "@/components/Shell";
import { LeagueTabs } from "@/components/LeagueTabs";

export const dynamic = "force-dynamic";

const VIEWS = [{ key: "", label: "Général" }, { key: "mois", label: "Mois" }, { key: "split", label: "Split" }] as const;

export default async function ClassementPage({ searchParams }: { searchParams: Promise<{ ligue?: string; vue?: string; p?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const league = isLeagueCode(sp.ligue) ? sp.ligue : undefined;
  const kind: PeriodKind | null = sp.vue === "mois" || sp.vue === "split" ? sp.vue : null;
  const now = new Date();
  const asked = parsePeriod(sp.p);
  const period = kind ? (asked && asked.kind === kind && asked.from <= now ? asked : periodOf(kind, now)) : null;
  const rows = await leaderboard(league, period ?? undefined);
  const podium = rows.slice(0, 3).filter((r) => r.points > 0);
  const me = rows.find((r) => r.userId === user.id);
  const running = period ? period.to > now : false;

  const qs = (o: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ligue: league, vue: kind ?? undefined, p: period?.id, ...o }).filter(([, v]) => v) as [string, string][]).toString();
    return `/classement${q ? `?${q}` : ""}`;
  };
  const prev = period && shiftPeriod(period, -1);
  const next = period && shiftPeriod(period, 1);

  return (
    <Shell user={user} active="/classement">
      <PageTitle kicker={[league, period?.label ?? "Général"].filter(Boolean).join(" · ")} title="Classement">
        {me && (
          <div className="card flex w-full items-center justify-between px-4 py-2.5 sm:block sm:w-auto sm:px-5 sm:py-3 sm:text-right">
            <div className="text-xs uppercase text-wina-muted">Ta position</div>
            <div className="h-display text-2xl sm:text-3xl"><span className="text-wina-red">#{me.rank}</span> · {me.points} pts</div>
          </div>
        )}
      </PageTitle>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex w-full gap-1 sm:w-auto">
          {VIEWS.map((v) => (
            <Link key={v.key} href={qs({ vue: v.key || undefined, p: undefined })}
              className={`flex-1 sm:flex-none ${(kind ?? "") === v.key ? "btn-red" : "btn-ghost"}`}>{v.label}</Link>
          ))}
        </div>
        {period && (
          <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto">
            <Link href={qs({ p: prev!.id })} className="btn-ghost px-3" aria-label={`Période précédente : ${prev!.label}`}>‹</Link>
            <div className="min-w-44 text-center">
              <div className="h-display text-2xl leading-none">{period.label}</div>
              <div className="text-xs text-wina-muted">{running ? "En cours" : "Terminé"}</div>
            </div>
            {next!.from <= now
              ? <Link href={qs({ p: next!.id })} className="btn-ghost px-3" aria-label={`Période suivante : ${next!.label}`}>›</Link>
              : <span className="btn-ghost invisible px-3" aria-hidden>›</span>}
          </div>
        )}
      </div>
      <div className="mb-6"><LeagueTabs base="/classement" current={league} extra={{ ...(kind ? { vue: kind } : {}), ...(period ? { p: period.id } : {}) }} /></div>

      {podium.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:gap-3">
          {podium.map((r, i) => (
            <Link key={r.userId} href={`/joueurs/${r.userId}`} className={`card relative min-w-0 overflow-hidden p-3 transition hover:border-white sm:p-5 ${i === 0 ? "border-wina-gold" : ""}`}>
              <div className="h-display absolute -right-1 -top-2 text-6xl text-white/5 sm:-right-2 sm:-top-4 sm:text-8xl">{r.rank}</div>
              <div className={`skew-tag ${i === 0 ? "bg-wina-gold text-black" : "bg-wina-red"}`}>
                {i === 0 && period ? (running ? "Leader" : period.kind === "mois" ? "Champion du mois" : "Champion du split") : `#${r.rank}`}
              </div>
              <div className="h-display mt-2 truncate text-lg sm:text-3xl">{r.displayName}</div>
              <div className="text-xs text-wina-muted sm:text-base"><b className="text-white">{r.points} pts</b><span className="hidden sm:inline"> · {r.exact} scores exacts</span></div>
            </Link>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
          <thead className="h-display bg-wina-ink text-base text-wina-muted">
            <tr>
              <th className="px-4 py-3">#</th><th className="px-4 py-3">Joueur</th>
              <th className="px-4 py-3 text-right">Points</th><th className="hidden px-4 py-3 text-right sm:table-cell">Bons vainqueurs</th>
              <th className="px-4 py-3 text-right">Exacts</th><th className="hidden px-4 py-3 text-right min-[361px]:table-cell">Réussite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className={`border-t border-wina-line ${r.userId === user.id ? "bg-wina-red/15" : ""}`}>
                <td className="h-display px-4 py-3 text-lg">{r.rank}</td>
                <td className="max-w-[130px] truncate px-4 py-3 font-semibold sm:max-w-none">
                  <Link href={r.userId === user.id ? "/profil" : `/joueurs/${r.userId}`} className="hover:underline">{r.displayName}</Link>
                  {r.userId === user.id && <span className="ml-2 text-xs text-wina-red">toi</span>}
                </td>
                <td className="h-display px-4 py-3 text-right text-xl">{r.points}</td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">{r.correct}/{r.played}</td>
                <td className="px-4 py-3 text-right">{r.exact}</td>
                <td className="hidden px-4 py-3 text-right text-wina-muted min-[361px]:table-cell">{r.played ? Math.round((r.correct / r.played) * 100) : 0}%</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-wina-muted">Personne n&apos;est encore inscrit.</td></tr>}
          </tbody>
        </table>
      </div>
      {period && rows.every((r) => r.points === 0) && <p className="mt-3 text-sm text-wina-muted">Aucun point marqué sur cette période pour l&apos;instant.</p>}
    </Shell>
  );
}
