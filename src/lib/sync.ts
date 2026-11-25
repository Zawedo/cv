import { prisma } from "./db";
import { config } from "./config";
import { scorePrediction } from "./scoring";
import { FORMATS, detectFormat, nodeForTab, scoreBracket, type BracketFormat, type Picks } from "./bracket";
import { leagueName } from "./leagues";
import { leaguepedia } from "./providers/leaguepedia";
import type { MatchProvider, ProviderBracketRow } from "./providers/types";

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

/** Recalcule les points de tous les tableaux remplis pour un tournoi (idempotent). */
export async function settleBracket(bracketId: string) {
  const b = await prisma.bracket.findUnique({ where: { id: bracketId }, include: { picks: true } });
  if (!b) return 0;
  const seeds = JSON.parse(b.seeds) as string[];
  const results = JSON.parse(b.results) as Picks;
  const started = Object.keys(results).length > 0;
  await prisma.$transaction(
    b.picks.map((p) => {
      const r = scoreBracket(b.format as BracketFormat, seeds, JSON.parse(p.picks), results);
      return prisma.bracketPick.update({
        where: { id: p.id },
        data: { points: started ? r.points : null, correct: started ? r.correct : null },
      });
    }),
  );
  return b.picks.length;
}

/** Construit les tableaux Worlds / MSI dès que les 8 équipes du premier tour sont connues. */
export async function upsertBrackets(rows: ProviderBracketRow[]) {
  const byTournament = new Map<string, ProviderBracketRow[]>();
  for (const r of rows) byTournament.set(r.tournamentKey, [...(byTournament.get(r.tournamentKey) ?? []), r]);

  let n = 0;
  for (const list of byTournament.values()) {
    const format = detectFormat(list.map((r) => r.tab));
    if (!format) continue;
    const nodes = new Map<string, ProviderBracketRow>();
    for (const r of list) {
      const id = nodeForTab(format, r.tab, r.n);
      if (id) nodes.set(id, r);
    }
    const firstRound = FORMATS[format].nodes.filter((d) => "seed" in d.a);
    const seeds: string[] = [];
    for (const d of firstRound) {
      const r = nodes.get(d.id);
      if (!r?.team1 || !r.team2) break;
      seeds.push(r.team1, r.team2);
    }
    if (seeds.length !== 8) continue; // affiches du premier tour pas encore connues

    const results: Picks = {};
    for (const [id, r] of nodes) {
      if (r.winner && r.team1 && r.team2) results[id] = r.winner === 1 ? r.team1 : r.team2;
    }
    const lockAt = new Date(Math.min(...firstRound.map((d) => nodes.get(d.id)!.startTime.getTime())));
    const { league } = list[0];
    const slug = `${league.toLowerCase()}-${lockAt.getUTCFullYear()}`;
    const data = {
      name: `${leagueName(league)} ${lockAt.getUTCFullYear()}`, event: league, format,
      seeds: JSON.stringify(seeds), results: JSON.stringify(results), lockAt,
    };
    const existing = await prisma.bracket.findUnique({ where: { slug } });
    if (existing?.manual) continue; // corrigé à la main par un admin
    const b = await prisma.bracket.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    await settleBracket(b.id);
    n++;
  }
  return n;
}

/** Récupère les logos manquants (ou vieux de plus de 7 jours). */
export async function syncLogos(provider: MatchProvider) {
  const [matchTeams, brackets, known] = await Promise.all([
    prisma.match.findMany({ select: { team1: true, team2: true }, where: { startTime: { gte: new Date(Date.now() - 200 * 864e5) } } }),
    prisma.bracket.findMany({ select: { seeds: true } }),
    prisma.team.findMany(),
  ]);
  const names = new Set<string>();
  matchTeams.forEach((m) => { names.add(m.team1); names.add(m.team2); });
  brackets.forEach((b) => (JSON.parse(b.seeds) as string[]).forEach((t) => names.add(t)));
  const fresh = new Set(known.filter((t) => t.checkedAt && t.checkedAt > new Date(Date.now() - 7 * 864e5)).map((t) => t.name));
  const todo = [...names].filter((t) => !fresh.has(t));
  if (!todo.length) return 0;
  const logos = await provider.fetchLogos(todo);
  const now = new Date();
  await prisma.$transaction(
    Object.entries(logos).map(([name, logoUrl]) =>
      prisma.team.upsert({ where: { name }, create: { name, logoUrl, checkedAt: now }, update: { logoUrl, checkedAt: now } }),
    ),
  );
  return Object.values(logos).filter(Boolean).length;
}

export async function syncMatches(opts: { daysBack?: number; daysAhead?: number } = {}) {
  const provider = getProvider();
  if (!provider) return { provider: "none", upserted: 0, settled: 0, brackets: 0, logos: 0 };
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
  const brackets = await upsertBrackets(await provider.fetchBracketRows(from, to));
  let logos = 0;
  try {
    logos = await syncLogos(provider);
  } catch (e) {
    console.warn("[sync] logos :", (e as Error).message); // non bloquant
  }
  return { provider: provider.name, upserted, settled, brackets, logos };
}
