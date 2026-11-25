import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leaderboard } from "@/lib/queries";
import { dayLabel, timeLabel } from "@/lib/format";
import { leagueInfo } from "@/lib/leagues";
import { Shell, PageTitle } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const user = await requireUser();
  const [preds, board] = await Promise.all([
    prisma.prediction.findMany({ where: { userId: user.id }, include: { match: true }, orderBy: { match: { startTime: "desc" } }, take: 200 }),
    leaderboard(),
  ]);
  const me = board.find((r) => r.userId === user.id);
  const pending = preds.filter((p) => p.points == null).length;

  const stats = [
    { label: "Rang", value: me ? `#${me.rank}` : "–" },
    { label: "Points", value: me?.points ?? 0 },
    { label: "Bons vainqueurs", value: `${me?.correct ?? 0}/${me?.played ?? 0}` },
    { label: "Scores exacts", value: me?.exact ?? 0 },
    { label: "En attente", value: pending },
  ];

  return (
    <Shell user={user} active="/profil">
      <PageTitle kicker={user.email} title={user.displayName} />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs uppercase text-wina-muted">{s.label}</div>
            <div className="h-display text-3xl">{s.value}</div>
          </div>
        ))}
      </div>

      <h2 className="h-display mb-3 text-2xl">Historique</h2>
      <div className="card divide-y divide-wina-line">
        {preds.map(({ match: m, ...p }) => {
          const pickedName = p.team1Score > p.team2Score ? m.team1 : m.team2;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="skew-tag text-white" style={{ background: leagueInfo(m.league)?.color }}>{m.league}</span>
              <span className="w-40 text-wina-muted">{dayLabel(m.startTime)} {timeLabel(m.startTime)}</span>
              <span className="flex-1 font-semibold">{m.team1} <span className="text-wina-muted">vs</span> {m.team2}</span>
              <span>Prono : <b>{pickedName}</b> {m.bestOf > 1 && `(${p.team1Score}-${p.team2Score})`}</span>
              <span className="w-28 text-right">
                {m.status === "FINISHED" ? <span className="text-wina-muted">{m.team1Score}-{m.team2Score} · </span> : null}
                {p.points == null ? <span className="text-wina-muted">en attente</span>
                  : <b className={p.points > 0 ? (p.exact ? "text-wina-gold" : "text-green-400") : "text-wina-muted"}>+{p.points}</b>}
              </span>
            </div>
          );
        })}
        {preds.length === 0 && <div className="p-10 text-center text-wina-muted">Aucun prono pour l&apos;instant. Direction l&apos;onglet Matchs !</div>}
      </div>
    </Shell>
  );
}
