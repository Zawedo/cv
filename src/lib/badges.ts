// Badges, calculés à partir de l'activité d'un joueur. Pur et testable.

export type BadgeTier = "bronze" | "argent" | "or";
export type Badge = {
  id: string; name: string; desc: string; icon: string; tier: BadgeTier;
  earned: boolean; progress?: [number, number]; detail?: string;
};

export type BadgeInput = {
  /** Pronos sur des matchs terminés, triés par date de match croissante */
  settled: { points: number; exact: boolean; multiplier: number; bestOf: number; league: string }[];
  totalPredictions: number;
  brackets: { complete: boolean; championRight: boolean; perfect: boolean }[];
  monthWins: string[]; // libellés des mois remportés
  splitPodiums: string[]; // libellés des splits terminés sur le podium
};

const MAJOR = ["LCK", "LPL", "LEC", "LCS"];

function bestStreak(settled: BadgeInput["settled"]) {
  let best = 0, cur = 0;
  for (const p of settled) { cur = p.points > 0 ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

export function computeBadges(i: BadgeInput): Badge[] {
  const exact = i.settled.filter((p) => p.exact).length;
  const outsiders = i.settled.filter((p) => p.points > 0 && p.multiplier > 1);
  const streak = bestStreak(i.settled);
  const leaguesWon = new Set(i.settled.filter((p) => p.points > 0 && MAJOR.includes(p.league)).map((p) => p.league));
  const count = (id: string, name: string, desc: string, icon: string, tier: BadgeTier, n: number, goal: number): Badge =>
    ({ id, name, desc, icon, tier, earned: n >= goal, progress: [Math.min(n, goal), goal] });
  const flag = (id: string, name: string, desc: string, icon: string, tier: BadgeTier, earned: boolean, detail?: string): Badge =>
    ({ id, name, desc, icon, tier, earned, detail });

  return [
    count("first", "Premier prono", "Faire son premier prono", "🎯", "bronze", i.totalPredictions, 1),
    count("regular", "Habitué", "50 pronos", "📅", "argent", i.totalPredictions, 50),
    count("centurion", "Centurion", "200 pronos", "🛡️", "or", i.totalPredictions, 200),
    count("streak5", "Série de 5", "5 bons vainqueurs d'affilée", "🔥", "argent", streak, 5),
    count("streak10", "Inarrêtable", "10 bons vainqueurs d'affilée", "⚡", "or", streak, 10),
    count("sniper", "Sniper", "10 scores exacts", "🔭", "argent", exact, 10),
    count("flair", "Flair", "Gagner un bonus contre la majorité", "🃏", "bronze", outsiders.length, 1),
    count("hunter", "Chasseur d'outsiders", "5 bonus contre la majorité", "🐺", "or", outsiders.length, 5),
    flag("masterstroke", "Coup de maître", "Score exact en BO5 avec le bonus ×2", "👑", "or", outsiders.some((p) => p.exact && p.bestOf >= 5 && p.multiplier >= 2)),
    count("globetrotter", "Globe-trotter", "Un bon prono en LCK, LPL, LEC et LCS", "🌍", "argent", leaguesWon.size, 4),
    flag("architect", "Architecte", "Remplir un tableau en entier", "📐", "bronze", i.brackets.some((b) => b.complete)),
    flag("visionary", "Visionnaire", "Trouver le champion d'un tableau", "🔮", "argent", i.brackets.some((b) => b.championRight)),
    flag("oracle", "Oracle", "Un tableau parfait", "🏛️", "or", i.brackets.some((b) => b.perfect)),
    flag("monthChamp", "Champion du mois", "Finir 1er d'un classement mensuel", "🏆", "or", i.monthWins.length > 0, i.monthWins.join(", ") || undefined),
    flag("splitPodium", "Podium de split", "Finir dans le top 3 d'un split", "🥉", "argent", i.splitPodiums.length > 0, i.splitPodiums.join(", ") || undefined),
  ];
}
