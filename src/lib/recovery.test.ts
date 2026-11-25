import { test } from "node:test";
import assert from "node:assert/strict";
import { newRecoveryCode, normalizeCode, hashCode, codeMatches } from "./recovery.ts";

test("code de récupération", () => {
  const c = newRecoveryCode();
  assert.match(c, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  assert.notEqual(newRecoveryCode(), c);
  assert.equal(normalizeCode(" k7qm 4xpa "), "K7QM-4XPA");
  assert.ok(codeMatches("k7qm4xpa", hashCode("K7QM-4XPA")));
  assert.ok(!codeMatches("K7QM-4XPB", hashCode("K7QM-4XPA")));
  assert.ok(!codeMatches("K7QM-4XPA", null));
});
