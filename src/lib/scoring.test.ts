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
