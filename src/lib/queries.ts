import "server-only";
import { prisma } from "./db";
import { INTERNATIONAL, leagueInfo, type LeagueCode } from "./leagues";
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
  const [mine, groups, logos] = await Promise.all([
    prisma.prediction.findMany({ where: { userId, matchId: { in: ids } } }),
    prisma.prediction.groupBy({ by: ["matchId", "team1Score", "team2Score"], where: { matchId: { in: ids } }, _count: true }),
    getLogos(matches.flatMap((m) => [m.team1, m.team2])),
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
      community: p || locked ? { total, team1: t1, team1Pct: total ? Math.round((t1 / total) * 100) : 50 } : null,
    };
  });
}

export type Standing = {
  rank: number; userId: string; displayName: string; points: number; correct: number; exact: number; played: number; bracketPoints: number;
};

export async function leaderboard(league?: LeagueCode): Promise<Standing[]> {
  const where = { points: { not: null }, ...(league ? { match: { league } } : {}) };
  const withBrackets = !league || INTERNATIONAL.includes(league);
  const [totals, correct, exact, users, brackets] = await Promise.all([
    prisma.prediction.groupBy({ by: ["userId"], where, _sum: { points: true }, _count: true }),
    prisma.prediction.groupBy({ by: ["userId"], where: { ...where, points: { gt: 0 } }, _count: true }),
    prisma.prediction.groupBy({ by: ["userId"], where: { ...where, exact: true }, _count: true }),
    prisma.user.findMany({ where: { displayName: { not: null } }, select: { id: true, displayName: true } }),
    withBrackets
      ? prisma.bracketPick.groupBy({ by: ["userId"], where: { points: { not: null }, ...(league ? { bracket: { event: league } } : {}) }, _sum: { points: true } })
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
