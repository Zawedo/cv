import { requireUser } from "@/lib/auth";
import { isLeagueCode } from "@/lib/leagues";
import { leaderboard } from "@/lib/queries";
import { Shell, PageTitle } from "@/components/Shell";
import { LeagueTabs } from "@/components/LeagueTabs";

export const dynamic = "force-dynamic";

export default async function ClassementPage({ searchParams }: { searchParams: Promise<{ ligue?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const league = isLeagueCode(sp.ligue) ? sp.ligue : undefined;
  const rows = await leaderboard(league);
  const podium = rows.slice(0, 3).filter((r) => r.points > 0);
  const me = rows.find((r) => r.userId === user.id);

  return (
    <Shell user={user} active="/classement">
      <PageTitle kicker={league ?? "Général"} title="Classement">
        {me && (
          <div className="card px-5 py-3 text-right">
            <div className="text-xs uppercase text-wina-muted">Ta position</div>
            <div className="h-display text-3xl"><span className="text-wina-red">#{me.rank}</span> · {me.points} pts</div>
          </div>
        )}
      </PageTitle>
      <div className="mb-6"><LeagueTabs base="/classement" current={league} /></div>

      {podium.length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {podium.map((r, i) => (
            <div key={r.userId} className={`card relative overflow-hidden p-5 ${i === 0 ? "border-wina-gold" : ""}`}>
              <div className="h-display absolute -right-2 -top-4 text-8xl text-white/5">{r.rank}</div>
              <div className={`skew-tag ${i === 0 ? "bg-wina-gold text-black" : "bg-wina-red"}`}>#{r.rank}</div>
              <div className="h-display mt-2 truncate text-3xl">{r.displayName}</div>
              <div className="text-wina-muted"><b className="text-white">{r.points} pts</b> · {r.exact} scores exacts</div>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="h-display bg-wina-ink text-base text-wina-muted">
            <tr>
              <th className="px-4 py-3">#</th><th className="px-4 py-3">Joueur</th>
              <th className="px-4 py-3 text-right">Points</th><th className="px-4 py-3 text-right">Bons vainqueurs</th>
              <th className="px-4 py-3 text-right">Scores exacts</th><th className="px-4 py-3 text-right">Réussite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className={`border-t border-wina-line ${r.userId === user.id ? "bg-wina-red/15" : ""}`}>
                <td className="h-display px-4 py-3 text-lg">{r.rank}</td>
                <td className="px-4 py-3 font-semibold">{r.displayName}{r.userId === user.id && <span className="ml-2 text-xs text-wina-red">toi</span>}</td>
                <td className="h-display px-4 py-3 text-right text-xl">{r.points}</td>
                <td className="px-4 py-3 text-right">{r.correct}/{r.played}</td>
                <td className="px-4 py-3 text-right">{r.exact}</td>
                <td className="px-4 py-3 text-right text-wina-muted">{r.played ? Math.round((r.correct / r.played) * 100) : 0}%</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-wina-muted">Personne n&apos;est encore inscrit.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
