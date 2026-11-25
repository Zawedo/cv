// Tableaux à élimination (Worlds, MSI). Pur, sans dépendance : partagé client / serveur, testable.

export type BracketFormat = "SINGLE_ELIM_8" | "DOUBLE_ELIM_8";
type Src = { seed: number } | { from: string; take: "W" | "L" };
export type NodeDef = { id: string; label: string; col: number; side: "UB" | "LB" | "F"; pts: number; a: Src; b: Src };

const s = (seed: number): Src => ({ seed });
const W = (from: string): Src => ({ from, take: "W" });
const L = (from: string): Src => ({ from, take: "L" });

// Les nœuds sont listés dans un ordre où chaque source précède son utilisation.
export const FORMATS: Record<BracketFormat, { name: string; nodes: NodeDef[]; final: string }> = {
  SINGLE_ELIM_8: {
    name: "Élimination directe",
    final: "F",
    nodes: [
      { id: "QF1", label: "Quart 1", col: 0, side: "UB", pts: 10, a: s(0), b: s(1) },
      { id: "QF2", label: "Quart 2", col: 0, side: "UB", pts: 10, a: s(2), b: s(3) },
      { id: "QF3", label: "Quart 3", col: 0, side: "UB", pts: 10, a: s(4), b: s(5) },
      { id: "QF4", label: "Quart 4", col: 0, side: "UB", pts: 10, a: s(6), b: s(7) },
      { id: "SF1", label: "Demi 1", col: 1, side: "UB", pts: 20, a: W("QF1"), b: W("QF2") },
      { id: "SF2", label: "Demi 2", col: 1, side: "UB", pts: 20, a: W("QF3"), b: W("QF4") },
      { id: "F", label: "Finale", col: 2, side: "F", pts: 40, a: W("SF1"), b: W("SF2") },
    ],
  },
  DOUBLE_ELIM_8: {
    name: "Double élimination",
    final: "GF",
    nodes: [
      { id: "UB1", label: "Gagnants · Tour 1", col: 0, side: "UB", pts: 10, a: s(0), b: s(1) },
      { id: "UB2", label: "Gagnants · Tour 1", col: 0, side: "UB", pts: 10, a: s(2), b: s(3) },
      { id: "UB3", label: "Gagnants · Tour 1", col: 0, side: "UB", pts: 10, a: s(4), b: s(5) },
      { id: "UB4", label: "Gagnants · Tour 1", col: 0, side: "UB", pts: 10, a: s(6), b: s(7) },
      { id: "LB1", label: "Perdants · Tour 1", col: 1, side: "LB", pts: 10, a: L("UB1"), b: L("UB2") },
      { id: "LB2", label: "Perdants · Tour 1", col: 1, side: "LB", pts: 10, a: L("UB3"), b: L("UB4") },
      { id: "UBS1", label: "Gagnants · Demi", col: 1, side: "UB", pts: 10, a: W("UB1"), b: W("UB2") },
      { id: "UBS2", label: "Gagnants · Demi", col: 1, side: "UB", pts: 10, a: W("UB3"), b: W("UB4") },
      { id: "LBQ1", label: "Perdants · Tour 2", col: 2, side: "LB", pts: 10, a: L("UBS2"), b: W("LB1") },
      { id: "LBQ2", label: "Perdants · Tour 2", col: 2, side: "LB", pts: 10, a: L("UBS1"), b: W("LB2") },
      { id: "UBF", label: "Finale des gagnants", col: 2, side: "UB", pts: 20, a: W("UBS1"), b: W("UBS2") },
      { id: "LBS", label: "Perdants · Tour 3", col: 3, side: "LB", pts: 10, a: W("LBQ2"), b: W("LBQ1") },
      { id: "LBF", label: "Finale des perdants", col: 4, side: "LB", pts: 20, a: L("UBF"), b: W("LBS") },
      { id: "GF", label: "Grande finale", col: 5, side: "F", pts: 40, a: W("UBF"), b: W("LBF") },
    ],
  },
};

/** Correspondance onglet Leaguepedia (+ n° du match dans l'onglet) → nœud du tableau. */
const LP_TABS: Record<BracketFormat, Record<string, string[]>> = {
  SINGLE_ELIM_8: { Quarterfinals: ["QF1", "QF2", "QF3", "QF4"], Semifinals: ["SF1", "SF2"], Finals: ["F"] },
  DOUBLE_ELIM_8: {
    "Bracket Round 1": ["UB1", "UB2", "UB3", "UB4", "LB1", "LB2"],
    "Bracket Round 2": ["UBS1", "UBS2", "LBQ1", "LBQ2"],
    "Bracket Round 3": ["LBS"],
    "Bracket Round 4": ["UBF", "LBF"],
    Finals: ["GF"],
  },
};

export function detectFormat(tabs: string[]): BracketFormat | null {
  if (tabs.includes("Bracket Round 1")) return "DOUBLE_ELIM_8";
  if (tabs.includes("Quarterfinals")) return "SINGLE_ELIM_8";
  return null;
}

export function nodeForTab(format: BracketFormat, tab: string, n: number): string | null {
  return LP_TABS[format][tab]?.[n - 1] ?? null;
}

export type Picks = Record<string, string>; // nodeId -> équipe désignée gagnante
export type ResolvedNode = NodeDef & { teamA: string | null; teamB: string | null; pick: string | null };

/** Calcule les affiches de chaque nœud à partir des têtes de série et des vainqueurs choisis ; ignore les choix devenus incohérents. */
export function resolve(format: BracketFormat, seeds: string[], picks: Picks): { nodes: ResolvedNode[]; picks: Picks } {
  const byId = new Map<string, ResolvedNode>();
  const clean: Picks = {};
  const team = (src: Src): string | null => {
    if ("seed" in src) return seeds[src.seed] ?? null;
    const n = byId.get(src.from);
    if (!n || !n.pick) return null;
    if (src.take === "W") return n.pick;
    return n.pick === n.teamA ? n.teamB : n.teamA;
  };
  for (const def of FORMATS[format].nodes) {
    const teamA = team(def.a);
    const teamB = team(def.b);
    const p = picks[def.id];
    const pick = p && (p === teamA || p === teamB) && teamA && teamB ? p : null;
    if (pick) clean[def.id] = pick;
    const node = { ...def, teamA, teamB, pick };
    byId.set(def.id, node);
  }
  return { nodes: [...byId.values()], picks: clean };
}

export function isComplete(format: BracketFormat, seeds: string[], picks: Picks): boolean {
  return Object.keys(resolve(format, seeds, picks).picks).length === FORMATS[format].nodes.length;
}

/** Points : chaque nœud où l'équipe pronostiquée gagnante a réellement gagné ce match rapporte ses points. */
export function scoreBracket(format: BracketFormat, seeds: string[], picks: Picks, results: Picks) {
  const mine = resolve(format, seeds, picks).picks;
  let points = 0, correct = 0, decided = 0;
  for (const def of FORMATS[format].nodes) {
    const r = results[def.id];
    if (!r) continue;
    decided++;
    if (mine[def.id] === r) { points += def.pts; correct++; }
  }
  return { points, correct, decided };
}

export function maxBracketPoints(format: BracketFormat): number {
  return FORMATS[format].nodes.reduce((t, n) => t + n.pts, 0);
}

/** « LYON (2024 American Team) » → « LYON » */
export function displayTeam(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
