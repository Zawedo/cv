// Données de démonstration : `npm run db:seed`. Ne pas lancer en production.
import { PrismaClient } from "@prisma/client";
import { scorePrediction, scoreOptions } from "../src/lib/scoring";
import { resolve, FORMATS, scoreBracket, type BracketFormat, type Picks } from "../src/lib/bracket";

const prisma = new PrismaClient();

const TEAMS: Record<string, string[]> = {
  LCK: ["T1", "Gen.G", "Hanwha Life Esports", "KT Rolster", "Dplus KIA", "BNK FEARX"],
  LPL: ["Bilibili Gaming", "Top Esports", "JD Gaming", "Anyone's Legend", "Weibo Gaming", "Invictus Gaming"],
  LEC: ["G2 Esports", "Fnatic", "Karmine Corp", "Movistar KOI", "Team Vitality", "Team Heretics"],
  LCS: ["Cloud9", "FlyQuest", "Team Liquid", "100 Thieves", "Dignitas", "Shopify Rebellion"],
};
const PLAYERS = ["Faker2Poker", "Gank&Bluff", "AllInBaron", "NashorNuts", "TiltProof", "RiverKing", "SmiteOrFold", "ZedPokerFace"];

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

async function main() {
  await prisma.prediction.deleteMany();
  await prisma.match.deleteMany({ where: { externalId: { startsWith: "demo:" } } });

  const users = await Promise.all(
    PLAYERS.map((name, i) =>
      prisma.user.upsert({ where: { email: `demo${i}@winamax.fr` }, create: { email: `demo${i}@winamax.fr`, displayName: name }, update: { displayName: name } }),
    ),
  );

  const now = Date.now();
  const offsets = { LCK: 8, LPL: 10, LEC: 17, LCS: 22 } as const; // heure de Paris approx.
  let n = 0;
  for (const [league, teams] of Object.entries(TEAMS)) {
    for (let day = -6; day <= 6; day++) {
      if ((day + league.length) % 2 !== 0) continue;
      const d = new Date(now + day * 864e5);
      d.setUTCHours(offsets[league as keyof typeof offsets] - 1, 0, 0, 0);
      for (let k = 0; k < 2; k++) {
        const [a, b] = [...teams].sort(() => rnd() - 0.5);
        const bestOf = league === "LEC" && day < 0 ? 1 : day === 6 ? 5 : 3;
        const startTime = new Date(d.getTime() + k * 3 * 3600e3);
        const finished = startTime.getTime() + 3 * 3600e3 < now;
        const res = finished ? pick(scoreOptions(bestOf)) : null;
        const m = await prisma.match.create({
          data: {
            externalId: `demo:${n++}`, league, tournament: `${league} 2026`, stage: `Semaine ${7 + Math.floor((day + 7) / 7)}`,
            team1: a, team2: b, bestOf, startTime, status: finished ? "FINISHED" : startTime.getTime() < now ? "LIVE" : "UPCOMING",
            team1Score: res?.team1Score ?? null, team2Score: res?.team2Score ?? null, winner: res ? (res.team1Score > res.team2Score ? 1 : 2) : null,
          },
        });
        for (const u of users) {
          if (rnd() < 0.25 || (!finished && rnd() < 0.5)) continue;
          const p = pick(scoreOptions(bestOf));
          const r = res ? scorePrediction(bestOf, p, res) : null;
          await prisma.prediction.create({ data: { userId: u.id, matchId: m.id, ...p, points: r?.points ?? null, exact: r?.exact ?? null } });
        }
      }
    }
  }
  // Tableau de démo ouvert (fictif) pour tester le remplissage
  const lockAt = new Date(now + 9 * 864e5);
  await prisma.bracket.upsert({
    where: { slug: "demo-msi" },
    create: { slug: "demo-msi", name: "MSI Démo", event: "MSI", format: "DOUBLE_ELIM_8", lockAt, manual: true,
      seeds: JSON.stringify(["Gen.G", "Team Liquid", "G2 Esports", "Top Esports", "Bilibili Gaming", "Karmine Corp", "Hanwha Life Esports", "FlyQuest"]) },
    update: { lockAt },
  });

  // Tableaux remplis au hasard par les joueurs de démo, sur tous les tableaux existants
  for (const b of await prisma.bracket.findMany()) {
    const format = b.format as BracketFormat;
    const seeds = JSON.parse(b.seeds) as string[];
    for (const u of users) {
      if (rnd() < 0.2) continue;
      const picks: Picks = {};
      for (const def of FORMATS[format].nodes) {
        const node = resolve(format, seeds, picks).nodes.find((x) => x.id === def.id)!;
        if (node.teamA && node.teamB) picks[def.id] = rnd() < 0.5 ? node.teamA : node.teamB;
      }
      const results = JSON.parse(b.results) as Picks;
      const started = Object.keys(results).length > 0;
      const r = scoreBracket(format, seeds, picks, results);
      await prisma.bracketPick.upsert({
        where: { userId_bracketId: { userId: u.id, bracketId: b.id } },
        create: { userId: u.id, bracketId: b.id, picks: JSON.stringify(picks), points: started ? r.points : null, correct: started ? r.correct : null },
        update: { picks: JSON.stringify(picks), points: started ? r.points : null, correct: started ? r.correct : null },
      });
    }
  }
  console.log(`Démo : ${users.length} joueurs, ${n} matchs, tableaux remplis.`);
}

main().finally(() => prisma.$disconnect());
