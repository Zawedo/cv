import { test } from "node:test";
import assert from "node:assert/strict";
import { mapRow } from "./leaguepedia.ts";

const base = {
  MatchId: "LCK/2026 Season/Spring_Week 1_1", Team1: "T1", Team2: "Gen.G", Team1Score: "2", Team2Score: "1",
  Winner: "1", BestOf: "3", DateTime: "2026-04-01 08:00:00", Tab: "Week 1", N: "1", Tournament: "LCK 2026 Spring", OverviewPage: "LCK/2026 Season/Spring", League: "LoL Champions Korea",
};

test("ligne terminée", () => {
  const m = mapRow(base)!;
  assert.equal(m.league, "LCK");
  assert.equal(m.status, "FINISHED");
  assert.equal(m.winner, 1);
  assert.equal(m.startTime.toISOString(), "2026-04-01T08:00:00.000Z");
});

test("match à venir, ligue inconnue, TBD", () => {
  const now = new Date("2026-03-01T00:00:00Z");
  assert.equal(mapRow({ ...base, Winner: null, Team1Score: null, Team2Score: null }, now)!.status, "UPCOMING");
  assert.equal(mapRow({ ...base, League: "LoL Japan League" }), null);
  assert.equal(mapRow({ ...base, League: "World Championship" })!.league, "WORLDS");
  assert.equal(mapRow({ ...base, Team2: "TBD" }), null);
});
