import "server-only";
import { prisma } from "./db";
import { INTERNATIONAL, leagueInfo, type LeagueCode } from "./leagues";
import { completedPeriods, type Period, type PeriodKind } from "./periods";
import { computeBadges, type Badge } from "./badges";
import { FORMATS, resolve, scoreBracket, type BracketFormat, type Picks } from "./bracket";
import { timeLabel } from "./format";
import type { MatchCardData } from "@/components/MatchCard";
import type { Match, Prediction } from "@prisma/client";

export function isLocked(m: Pick<Match, "status" | "startTime">, now = new Date()) {
  return m.status !== "UPCOMING" || m.startTime <= now;
}

/** name → URL du logo, pour un ensemble d'équipes. */
export async function getLogos(names: Iterable<string>): Promise<Map<string, string | null>> {
  const rows = await prisma.team.findMany({ where: { name: { in: [...new Set(names)] }, logoUrl: { not: null } }, select: { name: true } });
  return new Map(rows.map((t) => [t.name, `/api/logo?t=${encodeURIComponent(t.name)}`]));
}

export async function toCards(matches: Match[], userId: string): Promise<MatchCardData[]> {
  const ids = matches.map((m) => m.id);
  const lockedIds = matches.filter((m) => isLocked(m)).map((m) => m.id);
  const [mine, groups, logos, others] = await Promise.all([
    prisma.prediction.findMany({ where: { userId, matchId: { in: ids } } }),
    prisma.prediction.groupBy({ by: ["matchId", "team1Score", "team2Score"], where: { matchId: { in: ids } }, _count: true }),
    getLogos(matches.flatMap((m) => [m.team1, m.team2])),
    // Pronos des autres : uniquement sur les matchs commencés
    prisma.prediction.findMany({
      where: { matchId: { in: lockedIds }, userId: { not: userId } },
      select: { matchId: true, team1Score: true, team2Score: true, points: true, multiplier: true, user: { select: { id: true, displayName: true } } },
    }),
  ]);
  const mineBy = new Map<string, Prediction>(mine.map((p) => [p.matchId, p]));
  const now = new Date();
  return matches.map((m) => {
    const p = mineBy.get(m.id) ?? null;
    const locked = isLocked(m, now);
    const g = groups.filter((x) => x.matchId === m.id);
    const total = g.reduce((s, x) => s + x._count, 0);
    const t1 = g.filter((x) => x.team1Score > x.team2Score).reduce((s, x) => s + x._count, 0);
    return {
      id: m.id, league: m.league, leagueColor: leagueInfo(m.league)?.color ?? "#555", leagueName: leagueInfo(m.league)?.name ?? m.league,
      logo1: logos.get(m.team1) ?? null, logo2: logos.get(m.team2) ?? null, tournament: m.tournament, stage: m.stage,
      team1: m.team1, team2: m.team2, bestOf: m.bestOf, time: timeLabel(m.startTime), status: m.status, locked,
      team1Score: m.team1Score, team2Score: m.team2Score,
      pick: p && { team1Score: p.team1Score, team2Score: p.team2Score, points: p.points, exact: p.exact, multiplier: p.multiplier },
      // La tendance de la communauté n'est visible qu'après avoir pronostiqué (ou une fois le match verrouillé)
      others: locked
        ? others.filter((o) => o.matchId === m.id && o.user.displayName)
          .map((o) => ({ userId: o.user.id, name: o.user.displayName!, team1Score: o.team1Score, team2Score: o.team2Score, points: o.points, multiplier: o.multiplier }))
          .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name))
        : [],
      community: p || locked ? { total, team1: t1, team1Pct: total ? Math.round((t1 / total) * 100) : 50 } : null,
    };
  });
}

export type Standing = {
  rank: number; userId: string; displayName: string; points: number; correct: number; exact: number; played: number; bracketPoints: number;
};

export async function leaderboard(league?: LeagueCode, period?: Pick<Period, "from" | "to">): Promise<Standing[]> {
  const range = period ? { gte: period.from, lt: period.to } : undefined;
  const matchFilter = { ...(league ? { league } : {}), ...(range ? { startTime: range } : {}) };
  const where = { points: { not: null }, ...(Object.keys(matchFilter).length ? { match: matchFilter } : {}) };
  const withBrackets = !league || INTERNATIONAL.includes(league);
  const [totals, correct, exact, users, brackets] = await Promise.all([
    prisma.prediction.groupBy({ by: ["userId"], where, _sum: { points: true }, _count: true }),
    prisma.prediction.groupBy({ by: ["userId"], where: { ...where, points: { gt: 0 } }, _count: true }),
    prisma.prediction.groupBy({ by: ["userId"], where: { ...where, exact: true }, _count: true }),
    prisma.user.findMany({ where: { displayName: { not: null } }, select: { id: true, displayName: true } }),
    withBrackets
      ? prisma.bracketPick.groupBy({ by: ["userId"], where: { points: { not: null }, bracket: { ...(league ? { event: league } : {}), ...(range ? { lockAt: range } : {}) } }, _sum: { points: true } })
      : Promise.resolve([]),
  ]);
  const bp = new Map(brackets.map((x) => [x.userId, x._sum.points ?? 0]));
  const t = new Map(totals.map((x) => [x.userId, x]));
  const c = new Map(correct.map((x) => [x.userId, x._count]));
  const e = new Map(exact.map((x) => [x.userId, x._count]));
  const rows = users.map((u) => ({
    userId: u.id, displayName: u.displayName!, points: (t.get(u.id)?._sum.points ?? 0) + (bp.get(u.id) ?? 0), bracketPoints: bp.get(u.id) ?? 0,
    played: t.get(u.id)?._count ?? 0, correct: c.get(u.id) ?? 0, exact: e.get(u.id) ?? 0,
  }));
  rows.sort((a, b) => b.points - a.points || b.exact - a.exact || b.correct - a.correct || a.displayName.localeCompare(b.displayName));
  // Classement « olympique » : égalité parfaite = même rang
  let rank = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.points !== r.points || prev.exact !== r.exact || prev.correct !== r.correct) rank = i + 1;
    return { ...r, rank };
  });
}

// ---------- Gagnants des périodes terminées (mis en cache 10 min)
let winnersCache: { at: number; data: Map<PeriodKind, { period: Period; podium: Standing[] }[]> } | null = null;

export async function periodWinners(): Promise<Map<PeriodKind, { period: Period; podium: Standing[] }[]>> {
  if (winnersCache && Date.now() - winnersCache.at < 10 * 60e3) return winnersCache.data;
  const first = await prisma.match.findFirst({ where: { status: "FINISHED" }, orderBy: { startTime: "asc" }, select: { startTime: true } });
  const data = new Map<PeriodKind, { period: Period; podium: Standing[] }[]>();
  for (const kind of ["mois", "split"] as PeriodKind[]) {
    const list = [];
    for (const period of first ? completedPeriods(kind, first.startTime, new Date()) : []) {
      const podium = (await leaderboard(undefined, period)).filter((r) => r.points > 0 && r.rank <= 3);
      if (podium.length) list.push({ period, podium });
    }
    data.set(kind, list);
  }
  winnersCache = { at: Date.now(), data };
  return data;
}

export async function getBadges(userId: string): Promise<Badge[]> {
  const [settled, total, picks, winners] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId, points: { not: null } }, orderBy: { match: { startTime: "asc" } },
      select: { points: true, exact: true, multiplier: true, match: { select: { bestOf: true, league: true } } },
    }),
    prisma.prediction.count({ where: { userId } }),
    prisma.bracketPick.findMany({ where: { userId }, include: { bracket: true } }),
    periodWinners(),
  ]);
  return computeBadges({
    settled: settled.map((p) => ({ points: p.points!, exact: !!p.exact, multiplier: p.multiplier ?? 1, bestOf: p.match.bestOf, league: p.match.league })),
    totalPredictions: total,
    brackets: picks.map((p) => {
      const format = p.bracket.format as BracketFormat;
      const seeds = JSON.parse(p.bracket.seeds) as string[];
      const results = JSON.parse(p.bracket.results) as Picks;
      const mine = resolve(format, seeds, JSON.parse(p.picks)).picks;
      const total = FORMATS[format].nodes.length;
      const final = FORMATS[format].final;
      const s = scoreBracket(format, seeds, mine, results);
      return { complete: Object.keys(mine).length === total, championRight: !!results[final] && mine[final] === results[final], perfect: s.decided === total && s.correct === total };
    }),
    monthWins: (winners.get("mois") ?? []).filter((w) => w.podium.some((r) => r.rank === 1 && r.userId === userId)).map((w) => w.period.label),
    splitPodiums: (winners.get("split") ?? []).filter((w) => w.podium.some((r) => r.userId === userId)).map((w) => w.period.label),
  });
}
