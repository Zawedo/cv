import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueCode } from "@/lib/leagues";
import { dayKey, dayLabel } from "@/lib/format";
import { toCards } from "@/lib/queries";
import { Shell, PageTitle } from "@/components/Shell";
import { LeagueTabs } from "@/components/LeagueTabs";
import { MatchCard } from "@/components/MatchCard";
import { POINTS_WINNER, BONUS_EXACT_BO3, BONUS_EXACT_BO5 } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function MatchsPage({ searchParams }: { searchParams: Promise<{ ligue?: string; vue?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const league = isLeagueCode(sp.ligue) ? sp.ligue : undefined;
  const results = sp.vue === "resultats";

  const matches = await prisma.match.findMany({
    where: {
      ...(league ? { league } : {}),
      ...(results ? { status: { in: ["FINISHED", "CANCELED"] } } : { status: { in: ["UPCOMING", "LIVE"] } }),
    },
    orderBy: { startTime: results ? "desc" : "asc" },
    take: 80,
  });
  const cards = await toCards(matches, user.id);

  const days: { key: string; label: string; items: typeof cards }[] = [];
  matches.forEach((m, i) => {
    const key = dayKey(m.startTime);
    let d = days.find((x) => x.key === key);
    if (!d) days.push((d = { key, label: dayLabel(m.startTime), items: [] }));
    d.items.push(cards[i]);
  });

  const toPredict = cards.filter((c) => !c.locked && !c.pick).length;
  const extra = { ...(results ? { vue: "resultats" } : {}) };

  return (
    <Shell user={user} active="/matchs">
      <PageTitle kicker={results ? "Résultats" : "À pronostiquer"} title={results ? "Matchs terminés" : "Prochains matchs"}>
        <div className="flex w-full gap-1 sm:w-auto">
          <Link href={`/matchs${league ? `?ligue=${league}` : ""}`} className={`flex-1 sm:flex-none ${!results ? "btn-red" : "btn-ghost"}`}>À venir</Link>
          <Link href={`/matchs?vue=resultats${league ? `&ligue=${league}` : ""}`} className={`flex-1 sm:flex-none ${results ? "btn-red" : "btn-ghost"}`}>Résultats</Link>
        </div>
      </PageTitle>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6 sm:gap-4">
        <LeagueTabs base="/matchs" current={league} extra={extra} />
        {!results && toPredict > 0 && (
          <span className="skew-tag bg-wina-gold text-black">{toPredict} match{toPredict > 1 ? "s" : ""} sans prono</span>
        )}
      </div>

      {!results && (
        <p className="mb-4 text-[13px] text-wina-muted sm:mb-6 sm:text-sm">
          Bon vainqueur : <b className="text-white">{POINTS_WINNER} pts</b> · Score exact en BO3 : <b className="text-white">+{BONUS_EXACT_BO3}</b> · en BO5 : <b className="text-white">+{BONUS_EXACT_BO5}</b> · Contre la majorité : <b className="text-white">×1,5</b> si 35 % ou moins ont fait ton choix, <b className="text-white">×2</b> sous 20 % (dès 5 pronos) · Les pronos ferment au coup d&apos;envoi.
        </p>
      )}

      {days.length === 0 && <div className="card p-10 text-center text-wina-muted">Aucun match pour le moment.</div>}

      <div className="space-y-8">
        {days.map((d) => (
          <section key={d.key}>
            <h2 className="h-display sticky top-[53px] z-10 mb-3 border-b border-wina-line bg-wina-black pb-1 pt-1.5 text-2xl sm:static sm:pt-0">{d.label}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {d.items.map((c) => <MatchCard key={c.id} m={c} />)}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
