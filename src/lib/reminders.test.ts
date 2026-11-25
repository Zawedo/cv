import { test } from "node:test";
import assert from "node:assert/strict";
import { closingSoon, channelSlot, parisClock, dmMatches, channelWeekly } from "./reminders.ts";

const m = (id: string, start: string, status = "UPCOMING") => ({ id, league: "LCK", team1: "T1", team2: "Gen.G", startTime: new Date(start), status });

test("matchs qui ferment dans l'heure", () => {
  const now = new Date("2026-12-01T08:00:00Z");
  const r = closingSoon([m("a", "2026-12-01T08:30:00Z"), m("b", "2026-12-01T09:00:00Z"), m("c", "2026-12-01T09:01:00Z"), m("d", "2026-12-01T07:59:00Z"), m("e", "2026-12-01T08:10:00Z", "LIVE")], now);
  assert.deepEqual(r.map((x) => x.id), ["a", "b"]);
});

test("créneaux de la chaîne en heure de Paris", () => {
  // lundi 30 nov. 2026, 7 h 30 UTC = 8 h 30 à Paris : trop tôt
  assert.deepEqual(channelSlot(new Date("2026-11-30T07:30:00Z")), { digestKey: null, weeklyKey: null, ymd: "2026-11-30" });
  // 8 h 05 UTC = 9 h 05 à Paris, un lundi
  assert.deepEqual(channelSlot(new Date("2026-11-30T08:05:00Z")), { digestKey: "digest:2026-11-30", weeklyKey: "weekly:2026-11-30", ymd: "2026-11-30" });
  // mardi : pas de classement hebdo
  assert.equal(channelSlot(new Date("2026-12-01T10:00:00Z")).weeklyKey, null);
  // 23 h 30 UTC = 0 h 30 le lendemain à Paris
  assert.equal(parisClock(new Date("2026-12-01T23:30:00Z")).ymd, "2026-12-02");
});

test("messages", () => {
  const one = dmMatches([m("a", "2026-12-01T08:30:00Z")], "https://x", (c) => c);
  assert.match(one.text, /T1 vs Gen\.G commence à 09:30/);
  const w = channelWeekly([{ rank: 1, displayName: "Ana", points: 120 }], { displayName: "Bob", team: "LYON (2024 American Team)", multiplier: 1.5, points: 23 }, "https://x");
  assert.match(JSON.stringify(w.blocks), /Bob\* a misé sur LYON contre la majorité \(×1,5, \+23 pts\)/);
});
