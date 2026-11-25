import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBadges, leaderboard } from "@/lib/queries";
import { dayLabel, timeLabel } from "@/lib/format";
import { leagueInfo } from "@/lib/leagues";
import { displayTeam, maxBracketPoints, type BracketFormat } from "@/lib/bracket";
import { Shell, PageTitle } from "@/components/Shell";
import { BadgeGrid } from "@/components/BadgeGrid";

export const dynamic = "force-dynamic";

export default async function JoueurPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (id === user.id) redirect("/profil");
  const player = await prisma.user.findUnique({ where: { id }, select: { id: true, displayName: true } });
  if (!player?.displayName) notFound();

  const now = new Date();
  const [preds, board, bracketPicks, badges, upcomingCount] = await Promise.all([
    // Uniquement les matchs commencés : les pronos à venir restent secrets
    prisma.prediction.findMany({
      where: { userId: id, match: { OR: [{ status: { not: "UPCOMING" } }, { startTime: { lte: now } }] } },
      include: { match: true }, orderBy: { match: { startTime: "desc" } }, take: 100,
    }),
    leaderboard(),
    prisma.bracketPick.findMany({ where: { userId: id, bracket: { lockAt: { lte: now } } }, include: { bracket: true }, orderBy: { bracket: { lockAt: "desc" } } }),
    getBadges(id),
    prisma.prediction.count({ where: { userId: id, match: { status: "UPCOMING", startTime: { gt: now } } } }),
  ]);
  const me = board.find((r) => r.userId === id);
  const underdogs = preds.filter((p) => (p.points ?? 0) > 0 && (p.multiplier ?? 1) > 1).length;
  const stats = [
    { label: "Rang", value: me ? `#${me.rank}` : "–" },
    { label: "Points", value: me?.points ?? 0 },
    { label: "Bons vainqueurs", value: `${me?.correct ?? 0}/${me?.played ?? 0}` },
    { label: "Scores exacts", value: me?.exact ?? 0 },
    { label: "Outsiders", value: underdogs },
    { label: "Pronos à venir", value: upcomingCount },
  ];

  return (
    <Shell user={user} active="/classement">
      <Link href="/classement" className="mb-3 inline-block text-sm text-wina-muted hover:text-white">← Classement</Link>
      <PageTitle kicker="Joueur" title={player.displayName} />
      <div className="mb-6 grid grid-cols-6 gap-2 sm:mb-8 sm:gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card col-span-2 min-w-0 p-3 sm:col-span-1 sm:p-4">
            <div className="truncate text-[10px] uppercase text-wina-muted sm:text-xs">{s.label}</div>
            <div className="h-display text-2xl sm:text-3xl">{s.value}</div>
          </div>
        ))}
      </div>

      <BadgeGrid badges={badges} own={false} />

      {bracketPicks.length > 0 && (
        <>
          <h2 className="h-display mb-3 text-2xl">Tableaux</h2>
          <div className="card mb-8 divide-y divide-wina-line">
            {bracketPicks.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="skew-tag text-white" style={{ background: leagueInfo(p.bracket.event)?.color }}>{leagueInfo(p.bracket.event)?.name}</span>
                <span className="flex-1 font-semibold">{p.bracket.name}</span>
                {p.points == null ? <span className="text-wina-muted">en attente</span>
                  : <b className="h-display text-xl">+{p.points} <span className="text-sm text-wina-muted">/ {maxBracketPoints(p.bracket.format as BracketFormat)}</span></b>}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="h-display mb-1 text-2xl">Historique</h2>
      <p className="mb-3 text-xs text-wina-muted">Les pronos apparaissent au coup d&apos;envoi de chaque match.</p>
      <div className="card divide-y divide-wina-line">
        {preds.map(({ match: m, ...p }) => (
          <div key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm [grid-template-areas:'tag_date_pts'_'teams_teams_teams'_'prono_prono_prono'] lg:grid-cols-[52px_210px_1fr_auto_100px] lg:[grid-template-areas:'tag_date_teams_prono_pts']">
            <span className="[grid-area:tag]"><span className="skew-tag text-white" style={{ background: leagueInfo(m.league)?.color }}>{leagueInfo(m.league)?.name}</span></span>
            <span className="text-wina-muted [grid-area:date]">{dayLabel(m.startTime)} · {timeLabel(m.startTime)}</span>
            <span className="font-semibold [grid-area:teams]">{displayTeam(m.team1)} <span className="text-wina-muted">vs</span> {displayTeam(m.team2)}
              {m.status === "FINISHED" && <span className="font-normal text-wina-muted"> ({m.team1Score}-{m.team2Score})</span>}</span>
            <span className="text-wina-muted [grid-area:prono]">Prono : <b className="text-white">{displayTeam(p.team1Score > p.team2Score ? m.team1 : m.team2)}</b> {m.bestOf > 1 && `(${p.team1Score}-${p.team2Score})`}</span>
            <span className="text-right [grid-area:pts]">
              {p.points == null ? <span className="text-wina-muted">en cours</span>
                : <b className={p.points > 0 ? (p.exact ? "text-wina-gold" : "text-green-400") : "text-wina-muted"}>+{p.points}{p.points > 0 && (p.multiplier ?? 1) > 1 && <span className="ml-1 text-xs text-wina-gold">×{String(p.multiplier).replace(".", ",")}</span>}</b>}
            </span>
          </div>
        ))}
        {preds.length === 0 && <div className="p-10 text-center text-wina-muted">Aucun prono visible pour l&apos;instant.</div>}
      </div>
    </Shell>
  );
}
