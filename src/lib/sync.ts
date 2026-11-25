import { prisma } from "./db";
import { config } from "./config";
import { scorePrediction } from "./scoring";
import { leaguepedia } from "./providers/leaguepedia";
import type { MatchProvider } from "./providers/types";

function getProvider(): MatchProvider | null {
  if (config.provider === "leaguepedia") return leaguepedia;
  return null;
}

/** Recalcule les points de tous les pronostics d'un match terminé (idempotent). */
export async function settleMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return 0;
  const preds = await prisma.prediction.findMany({ where: { matchId } });
  const finished = match.status === "FINISHED" && match.team1Score != null && match.team2Score != null;
  await prisma.$transaction(
    preds.map((p) => {
      const r = finished
        ? scorePrediction(match.bestOf, p, { team1Score: match.team1Score!, team2Score: match.team2Score! })
        : null;
      return prisma.prediction.update({
        where: { id: p.id },
        data: { points: r ? r.points : null, exact: r ? r.exact : null },
      });
    }),
  );
  return preds.length;
}

export async function settleAll() {
  const matches = await prisma.match.findMany({
    where: { OR: [{ status: "FINISHED" }, { predictions: { some: { points: { not: null } } } }] },
    select: { id: true },
  });
  let n = 0;
  for (const m of matches) n += await settleMatch(m.id);
  return n;
}

export async function syncMatches(opts: { daysBack?: number; daysAhead?: number } = {}) {
  const provider = getProvider();
  if (!provider) return { provider: "none", upserted: 0, settled: 0 };
  const from = new Date(Date.now() - (opts.daysBack ?? 14) * 864e5);
  const to = new Date(Date.now() + (opts.daysAhead ?? 30) * 864e5);
  const matches = await provider.fetchMatches(from, to);

  let upserted = 0;
  for (const m of matches) {
    const existing = await prisma.match.findUnique({ where: { externalId: m.externalId } });
    if (existing?.manual) continue; // un admin a corrigé ce match à la main : on ne l'écrase pas
    await prisma.match.upsert({ where: { externalId: m.externalId }, create: m, update: m });
    upserted++;
  }
  const settled = await settleAll();
  return { provider: provider.name, upserted, settled };
}
