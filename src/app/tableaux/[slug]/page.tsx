import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORMATS, displayTeam, maxBracketPoints, resolve, scoreBracket, type BracketFormat, type Picks } from "@/lib/bracket";
import { dayLabel, timeLabel } from "@/lib/format";
import { getLogos } from "@/lib/queries";
import { Shell, PageTitle } from "@/components/Shell";
import { BracketBoard } from "@/components/BracketBoard";

export const dynamic = "force-dynamic";

export default async function BracketPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const b = await prisma.bracket.findUnique({ where: { slug }, include: { picks: true } });
  if (!b) notFound();
  const format = b.format as BracketFormat;
  const seeds = JSON.parse(b.seeds) as string[];
  const results = JSON.parse(b.results) as Picks;
  const locked = b.lockAt <= new Date();
  const mine = b.picks.find((p) => p.userId === user.id);
  const myPicks = mine ? (JSON.parse(mine.picks) as Picks) : {};
  const score = scoreBracket(format, seeds, myPicks, results);
  const logos = Object.fromEntries(await getLogos(seeds));
  const final = FORMATS[format].final;

  // Champion le plus choisi : visible une fois le tableau verrouillé (pour ne pas influencer)
  const champCount = new Map<string, number>();
  if (locked) for (const p of b.picks) {
    const c = resolve(format, seeds, JSON.parse(p.picks)).picks[final];
    if (c) champCount.set(c, (champCount.get(c) ?? 0) + 1);
  }
  const champTotal = [...champCount.values()].reduce((a, n) => a + n, 0);
  const topChamps = [...champCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <Shell user={user} active="/tableaux">
      <Link href="/tableaux" className="mb-3 inline-block text-sm text-wina-muted hover:text-white">← Tous les tableaux</Link>
      <PageTitle kicker={FORMATS[format].name} title={b.name}>
        {locked && (
          <div className="card flex w-full items-center justify-between gap-6 px-4 py-2.5 sm:w-auto sm:px-5 sm:py-3">
            <div className="text-xs uppercase text-wina-muted">Tes points</div>
            <div className="h-display text-3xl">{mine ? score.points : 0}<span className="text-lg text-wina-muted"> / {maxBracketPoints(format)}</span></div>
          </div>
        )}
      </PageTitle>
      <p className="mb-6 text-sm text-wina-muted">
        {locked
          ? `Tableau verrouillé depuis le ${dayLabel(b.lockAt).toLowerCase()} à ${timeLabel(b.lockAt)}. ${mine ? `${score.correct} bon${score.correct > 1 ? "s" : ""} vainqueur${score.correct > 1 ? "s" : ""} sur ${score.decided} match${score.decided > 1 ? "s" : ""} joué${score.decided > 1 ? "s" : ""}.` : "Tu n'avais pas rempli ce tableau."}`
          : `Modifiable jusqu'au ${dayLabel(b.lockAt).toLowerCase()} à ${timeLabel(b.lockAt)}. Changer un vainqueur efface les choix qui en dépendaient.`}
      </p>

      {topChamps.length > 0 && (
        <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="text-xs uppercase text-wina-muted">Champions choisis ({champTotal})</span>
          {topChamps.map(([t, n]) => <span key={t}><b>{displayTeam(t)}</b> <span className="text-wina-muted">{Math.round((n / champTotal) * 100)}%</span></span>)}
        </div>
      )}

      <BracketBoard slug={b.slug} format={format} seeds={seeds} initialPicks={myPicks} results={results} locked={locked} logos={logos} />
    </Shell>
  );
}
