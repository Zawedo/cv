import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { dayLabel, timeLabel } from "@/lib/format";
import { Shell, PageTitle } from "@/components/Shell";
import { CreateMatchForm, ResultForm, SyncButton } from "./AdminForms";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  const [matches, users, preds] = await Promise.all([
    prisma.match.findMany({
      where: { startTime: { gte: new Date(Date.now() - 10 * 864e5), lte: new Date(Date.now() + 3 * 864e5) } },
      orderBy: { startTime: "desc" },
      include: { _count: { select: { predictions: true } } },
    }),
    prisma.user.count(),
    prisma.prediction.count(),
  ]);

  return (
    <Shell user={user} active="/admin">
      <PageTitle kicker="Back-office" title="Administration" />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-xs uppercase text-wina-muted">Joueurs</div><div className="h-display text-3xl">{users}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-wina-muted">Pronos</div><div className="h-display text-3xl">{preds}</div></div>
        <div className="card p-4"><div className="text-xs uppercase text-wina-muted">Source</div><div className="h-display text-3xl">{config.provider}</div></div>
      </div>

      <section className="card mb-8 space-y-3 p-5">
        <h2 className="h-display text-2xl">Synchronisation</h2>
        <p className="text-sm text-wina-muted">Récupère le calendrier et les résultats (J-14 à J+30), puis recalcule les points. Automatisable via <code>/api/cron/sync</code>.</p>
        <SyncButton />
      </section>

      <section className="card mb-8 space-y-3 p-5">
        <h2 className="h-display text-2xl">Ajouter un match manuellement</h2>
        <CreateMatchForm />
      </section>

      <section className="card p-5">
        <h2 className="h-display mb-1 text-2xl">Corriger un résultat</h2>
        <p className="mb-4 text-sm text-wina-muted">Un match corrigé à la main n&apos;est plus écrasé par la synchro. Matchs de J-10 à J+3.</p>
        <div className="divide-y divide-wina-line">
          {matches.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-12 font-bold">{m.league}</span>
              <span className="w-44 text-wina-muted">{dayLabel(m.startTime)} {timeLabel(m.startTime)}</span>
              <span className="min-w-48 flex-1">{m.team1} vs {m.team2} <span className="text-wina-muted">BO{m.bestOf} · {m._count.predictions} pronos{m.manual ? " · manuel" : ""}</span></span>
              <ResultForm id={m.id} bestOf={m.bestOf} status={m.status} s1={m.team1Score} s2={m.team2Score} />
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
