import { test } from "node:test";
import assert from "node:assert/strict";
import { periodOf, parsePeriod, shiftPeriod, completedPeriods, parisMidnight } from "./periods.ts";
import { computeBadges } from "./badges.ts";

test("mois à l'heure de Paris", () => {
  // 31 oct. 23 h 30 UTC = 1er nov. 0 h 30 à Paris
  assert.equal(periodOf("mois", new Date("2026-10-31T23:30:00Z")).id, "m-2026-11");
  assert.equal(parisMidnight(2026, 11, 1).toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(parisMidnight(2026, 7, 1).toISOString(), "2026-06-30T22:00:00.000Z", "heure d'été");
  const nov = parsePeriod("m-2026-11")!;
  assert.equal(nov.label, "Novembre 2026");
  assert.equal(shiftPeriod(nov, 1).id, "m-2026-12");
  assert.equal(shiftPeriod(shiftPeriod(nov, 1), 1).id, "m-2027-01");
});

test("splits", () => {
  assert.equal(periodOf("split", new Date("2026-03-15T12:00:00Z")).label, "Split 1 2026");
  assert.equal(periodOf("split", new Date("2026-07-12T12:00:00Z")).label, "Split 2 2026", "le MSI tombe dans le split 2");
  assert.equal(periodOf("split", new Date("2026-07-25T12:00:00Z")).label, "Split 3 2026");
  assert.equal(periodOf("split", new Date("2026-11-25T12:00:00Z")).id, "s-2026-4");
  assert.equal(shiftPeriod(parsePeriod("s-2026-4")!, 1).id, "s-2027-1");
  assert.equal(shiftPeriod(parsePeriod("s-2027-1")!, -1).id, "s-2026-4");
  assert.equal(parsePeriod("s-2026-9"), null);
  assert.deepEqual(completedPeriods("split", new Date("2026-05-01Z"), new Date("2026-11-25Z")).map((p) => p.id), ["s-2026-2", "s-2026-3"]);
});

test("badges", () => {
  const win = (o = {}) => ({ points: 10, exact: false, multiplier: 1, bestOf: 3, league: "LCK", ...o });
  const b = computeBadges({
    settled: [win(), win({ league: "LPL" }), win({ points: 0 }), ...Array(6).fill(0).map(() => win({ league: "LEC" })), win({ points: 40, exact: true, multiplier: 2, bestOf: 5, league: "LCS" })],
    totalPredictions: 12, brackets: [{ complete: true, championRight: false, perfect: false }], monthWins: ["Octobre 2026"], splitPodiums: [],
  });
  const get = (id: string) => b.find((x) => x.id === id)!;
  assert.ok(get("first").earned);
  assert.deepEqual(get("regular").progress, [12, 50]);
  assert.ok(get("streak5").earned, "série de 7");
  assert.ok(!get("streak10").earned);
  assert.ok(get("masterstroke").earned);
  assert.ok(get("globetrotter").earned);
  assert.ok(get("architect").earned && !get("visionary").earned);
  assert.equal(get("monthChamp").detail, "Octobre 2026");
});
