import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORMATS, displayTeam, maxBracketPoints, resolve, type BracketFormat } from "@/lib/bracket";
import { leagueInfo } from "@/lib/leagues";
import { dayLabel, timeLabel } from "@/lib/format";
import { getLogos } from "@/lib/queries";
import { Shell, PageTitle } from "@/components/Shell";
import { TeamLogo } from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function TableauxPage() {
  const user = await requireUser();
  const brackets = await prisma.bracket.findMany({ orderBy: { lockAt: "desc" }, include: { picks: { where: { userId: user.id } } } });
  const now = new Date();
  const champions = brackets.map((b) => (JSON.parse(b.results) as Record<string, string>)[FORMATS[b.format as BracketFormat].final] ?? null);
  const logos = await getLogos(champions.filter((c): c is string => !!c));

  return (
    <Shell user={user} active="/tableaux">
      <PageTitle kicker="MSI · Worlds" title="Tableaux" />
      <p className="mb-6 max-w-2xl text-sm text-wina-muted">
        Avant le premier match de la phase finale, remplis tout le tableau : choisis le vainqueur de chaque affiche jusqu&apos;au champion.
        Chaque bon vainqueur rapporte des points, de 10 au premier tour à 40 pour le champion. Les points s&apos;ajoutent au classement général.
      </p>
      {brackets.length === 0 && <div className="card p-10 text-center text-wina-muted">Les tableaux apparaîtront dès que les affiches de la phase finale seront connues.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {brackets.map((b, i) => {
          const format = b.format as BracketFormat;
          const total = FORMATS[format].nodes.length;
          const mine = b.picks[0];
          const done = mine ? Object.keys(resolve(format, JSON.parse(b.seeds), JSON.parse(mine.picks)).picks).length : 0;
          const open = b.lockAt > now;
          const champ = champions[i];
          const info = leagueInfo(b.event);
          return (
            <Link key={b.id} href={`/tableaux/${b.slug}`} className="card group block p-5 transition hover:border-white">
              <div className="flex items-center gap-2">
                <span className="skew-tag text-white" style={{ background: info?.color }}>{info?.name}</span>
                <span className="text-xs text-wina-muted">{FORMATS[format].name} · 8 équipes</span>
                <span className={`skew-tag ml-auto ${open ? "bg-green-600" : champ ? "bg-wina-line" : "bg-wina-red"}`}>{open ? "Ouvert" : champ ? "Terminé" : "En cours"}</span>
              </div>
              <h2 className="h-display mt-3 text-4xl">{b.name}</h2>
              <p className="mt-1 text-sm text-wina-muted">
                {open ? `Pronos jusqu'au ${dayLabel(b.lockAt).toLowerCase()} à ${timeLabel(b.lockAt)}` : `Phase finale lancée le ${dayLabel(b.lockAt).toLowerCase()}`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-wina-line pt-4 text-sm">
                {champ && <span className="flex items-center gap-2"><TeamLogo name={champ} src={logos.get(champ)} size={28} /><span>Champion : <b>{displayTeam(champ)}</b></span></span>}
                <span className="ml-auto">
                  {mine?.points != null ? <b className="h-display text-2xl">{mine.points} <span className="text-base text-wina-muted">/ {maxBracketPoints(format)} pts</span></b>
                    : open ? <b className={done === total ? "text-green-400" : "text-wina-gold"}>{done === total ? "Tableau complet ✓" : `${done}/${total} choix`}</b>
                    : <span className="text-wina-muted">{mine ? "En attente des résultats" : "Pas de tableau rempli"}</span>}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}
