// Barème des pronostics. Pur (aucune dépendance) pour être testable facilement.

export const POINTS_WINNER = 10;
export const BONUS_EXACT_BO3 = 5;
export const BONUS_EXACT_BO5 = 10;

export type Score = { team1Score: number; team2Score: number };

/** Liste des scores possibles pour un BO donné, du point de vue team1-team2. */
export function scoreOptions(bestOf: number): Score[] {
  const wins = Math.ceil(bestOf / 2);
  const team1Wins: Score[] = [];
  const team2Wins: Score[] = [];
  for (let loser = 0; loser < wins; loser++) {
    team1Wins.push({ team1Score: wins, team2Score: loser });
    team2Wins.push({ team1Score: loser, team2Score: wins });
  }
  // Ex. BO5 : 3-0 3-1 3-2 | 2-3 1-3 0-3
  return [...team1Wins, ...team2Wins.reverse()];
}

export function isValidScore(bestOf: number, s: Score): boolean {
  return scoreOptions(bestOf).some(
    (o) => o.team1Score === s.team1Score && o.team2Score === s.team2Score,
  );
}

export function winnerOf(s: Score): 1 | 2 {
  return s.team1Score > s.team2Score ? 1 : 2;
}

export function exactBonus(bestOf: number): number {
  if (bestOf >= 5) return BONUS_EXACT_BO5;
  if (bestOf >= 3) return BONUS_EXACT_BO3;
  return 0; // BO1 : le bon vainqueur est déjà le score exact
}

/** Points gagnés par un pronostic une fois le résultat connu. */
export function scorePrediction(
  bestOf: number,
  prediction: Score,
  result: Score,
): { points: number; exact: boolean } {
  const goodWinner = winnerOf(prediction) === winnerOf(result);
  const exact =
    prediction.team1Score === result.team1Score &&
    prediction.team2Score === result.team2Score;
  if (!goodWinner) return { points: 0, exact: false };
  return { points: POINTS_WINNER + (exact ? exactBonus(bestOf) : 0), exact };
}

export function maxPoints(bestOf: number): number {
  return POINTS_WINNER + exactBonus(bestOf);
}

// ---------- Bonus « contre la majorité »
// Le bon vainqueur choisi par peu de joueurs voit ses points multipliés.
export const UNDERDOG_MIN_PICKS = 5;
export const UNDERDOG_TIERS = [
  { maxShare: 0.2, multiplier: 2 },
  { maxShare: 0.35, multiplier: 1.5 },
] as const;

/** sameWinner : nombre de pronos (le sien compris) désignant le même vainqueur ; total : nombre de pronos sur le match. */
export function underdogMultiplier(sameWinner: number, total: number): number {
  if (total < UNDERDOG_MIN_PICKS || sameWinner <= 0) return 1;
  const share = sameWinner / total;
  for (const t of UNDERDOG_TIERS) if (share <= t.maxShare) return t.multiplier;
  return 1;
}

export function applyMultiplier(points: number, multiplier: number): number {
  return Math.round(points * multiplier);
}
