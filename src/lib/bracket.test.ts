import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, scoreBracket, isComplete, maxBracketPoints, nodeForTab, detectFormat, displayTeam, type Picks } from "./bracket.ts";

// Vrais résultats Worlds 2026 (Leaguepedia)
const WSEEDS = ["Top Esports", "Invictus Gaming", "Gen.G", "LYON (2024 American Team)", "Dplus Kia", "Bilibili Gaming", "Karmine Corp", "T1"];
const WRES: Picks = { QF1: "Invictus Gaming", QF2: "Gen.G", QF3: "Bilibili Gaming", QF4: "T1", SF1: "Gen.G", SF2: "Bilibili Gaming", F: "Bilibili Gaming" };

test("Worlds : les résultats réels forment un tableau cohérent", () => {
  const r = resolve("SINGLE_ELIM_8", WSEEDS, WRES);
  assert.equal(Object.keys(r.picks).length, 7);
  assert.equal(r.nodes.find((n) => n.id === "F")!.teamB, "Bilibili Gaming");
  assert.deepEqual(scoreBracket("SINGLE_ELIM_8", WSEEDS, WRES, WRES), { points: 120, correct: 7, decided: 7 });
  assert.equal(maxBracketPoints("SINGLE_ELIM_8"), 120);
});

test("changer un quart invalide les choix en aval", () => {
  const picks = { ...WRES, QF3: "Dplus Kia" };
  const r = resolve("SINGLE_ELIM_8", WSEEDS, picks);
  assert.equal(r.picks.QF3, "Dplus Kia");
  assert.equal(r.picks.SF2, undefined);
  assert.equal(r.picks.F, undefined);
  assert.ok(!isComplete("SINGLE_ELIM_8", WSEEDS, picks));
});

test("points partiels", () => {
  const picks = { QF1: "Top Esports", QF2: "Gen.G", QF3: "Bilibili Gaming", QF4: "T1", SF1: "Gen.G", SF2: "T1", F: "Gen.G" };
  // QF2, QF3, QF4 (30) + SF1 (20) = 50
  assert.deepEqual(scoreBracket("SINGLE_ELIM_8", WSEEDS, picks, WRES), { points: 50, correct: 4, decided: 7 });
});

// Vrais résultats MSI 2026, double élimination
const MSEEDS = ["Hanwha Life Esports", "Team Secret Whales", "G2 Esports", "Top Esports", "LYON (2024 American Team)", "FURIA", "Bilibili Gaming", "T1"];
const MRES: Picks = {
  UB1: "Hanwha Life Esports", UB2: "G2 Esports", UB3: "LYON (2024 American Team)", UB4: "Bilibili Gaming",
  LB1: "Team Secret Whales", LB2: "T1", UBS1: "Hanwha Life Esports", UBS2: "Bilibili Gaming",
  LBQ1: "LYON (2024 American Team)", LBQ2: "G2 Esports", UBF: "Bilibili Gaming", LBS: "LYON (2024 American Team)",
  LBF: "Hanwha Life Esports", GF: "Hanwha Life Esports",
};

test("MSI : le tableau double élimination reproduit les affiches réelles", () => {
  const r = resolve("DOUBLE_ELIM_8", MSEEDS, MRES);
  const n = Object.fromEntries(r.nodes.map((x) => [x.id, [x.teamA, x.teamB]]));
  assert.deepEqual(n.LB1, ["Team Secret Whales", "Top Esports"]);
  assert.deepEqual(n.LBQ1, ["LYON (2024 American Team)", "Team Secret Whales"]);
  assert.deepEqual(n.LBQ2, ["G2 Esports", "T1"]);
  assert.deepEqual(n.LBF, ["Hanwha Life Esports", "LYON (2024 American Team)"]);
  assert.deepEqual(n.GF, ["Bilibili Gaming", "Hanwha Life Esports"]);
  assert.equal(scoreBracket("DOUBLE_ELIM_8", MSEEDS, MRES, MRES).points, maxBracketPoints("DOUBLE_ELIM_8"));
});

test("correspondance Leaguepedia et noms", () => {
  assert.equal(detectFormat(["Bracket Round 1", "Finals"]), "DOUBLE_ELIM_8");
  assert.equal(nodeForTab("DOUBLE_ELIM_8", "Bracket Round 2", 4), "LBQ2");
  assert.equal(nodeForTab("SINGLE_ELIM_8", "Semifinals", 2), "SF2");
  assert.equal(displayTeam("LYON (2024 American Team)"), "LYON");
});
