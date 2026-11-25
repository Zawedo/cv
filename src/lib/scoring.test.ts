import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreOptions, scorePrediction, isValidScore } from "./scoring.ts";

test("options de score BO1 / BO3 / BO5", () => {
  assert.equal(scoreOptions(1).length, 2);
  assert.deepEqual(scoreOptions(3).map((s) => `${s.team1Score}-${s.team2Score}`), ["2-0", "2-1", "1-2", "0-2"]);
  assert.equal(scoreOptions(5).length, 6);
});

test("validation du score", () => {
  assert.ok(isValidScore(3, { team1Score: 2, team2Score: 1 }));
  assert.ok(!isValidScore(3, { team1Score: 3, team2Score: 1 }));
  assert.ok(!isValidScore(5, { team1Score: 2, team2Score: 2 }));
});

test("barème", () => {
  assert.deepEqual(scorePrediction(3, { team1Score: 2, team2Score: 1 }, { team1Score: 2, team2Score: 1 }), { points: 15, exact: true });
  assert.deepEqual(scorePrediction(3, { team1Score: 2, team2Score: 0 }, { team1Score: 2, team2Score: 1 }), { points: 10, exact: false });
  assert.deepEqual(scorePrediction(5, { team1Score: 0, team2Score: 3 }, { team1Score: 0, team2Score: 3 }), { points: 20, exact: true });
  assert.deepEqual(scorePrediction(5, { team1Score: 3, team2Score: 2 }, { team1Score: 2, team2Score: 3 }), { points: 0, exact: false });
  assert.deepEqual(scorePrediction(1, { team1Score: 1, team2Score: 0 }, { team1Score: 1, team2Score: 0 }), { points: 10, exact: true });
});

import { underdogMultiplier, applyMultiplier } from "./scoring.ts";

test("bonus contre la majorité", () => {
  assert.equal(underdogMultiplier(1, 4), 1, "moins de 5 pronos : pas de bonus");
  assert.equal(underdogMultiplier(1, 5), 2, "20 % pile : ×2");
  assert.equal(underdogMultiplier(2, 10), 2);
  assert.equal(underdogMultiplier(3, 10), 1.5, "30 % : ×1,5");
  assert.equal(underdogMultiplier(7, 20), 1.5, "35 % pile : ×1,5");
  assert.equal(underdogMultiplier(4, 10), 1, "40 % : pas de bonus");
  assert.equal(applyMultiplier(15, 1.5), 23);
  assert.equal(applyMultiplier(20, 2), 40);
  assert.equal(applyMultiplier(0, 2), 0);
});
