// Logique pure des rappels : quand envoyer et quoi écrire. Sans base ni réseau, donc testable.

const TZ = "Europe/Paris";

export const DM_MATCH_WINDOW_MIN = 60; // rappel privé si un match non pronostiqué commence dans l'heure
export const DM_BRACKET_WINDOW_H = 3; // rappel privé si un tableau incomplet ferme dans les 3 h
export const CHANNEL_HOUR = 9; // programme du jour et classement hebdo à partir de 9 h (Paris)

export function parisClock(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday as string };
}

export function timeFr(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}

const short = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, "");

type M = { id: string; league: string; team1: string; team2: string; startTime: Date; status: string };

export function closingSoon<T extends M>(matches: T[], now: Date, windowMin = DM_MATCH_WINDOW_MIN): T[] {
  const limit = now.getTime() + windowMin * 60e3;
  return matches.filter((m) => m.status === "UPCOMING" && m.startTime > now && m.startTime.getTime() <= limit);
}

/** Créneau d'envoi du programme du jour / du classement hebdo ? */
export function channelSlot(now: Date) {
  const c = parisClock(now);
  return { digestKey: c.hour >= CHANNEL_HOUR ? `digest:${c.ymd}` : null, weeklyKey: c.hour >= CHANNEL_HOUR && c.weekday === "Mon" ? `weekly:${c.ymd}` : null, ymd: c.ymd };
}

const button = (url: string, label: string) => ({
  type: "actions",
  elements: [{ type: "button", text: { type: "plain_text", text: label }, url, style: "danger" }],
});
const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
const line = (m: M, leagueName: (c: string) => string) => `• *${short(m.team1)}* vs *${short(m.team2)}* · ${leagueName(m.league)} · ${timeFr(m.startTime)}`;

export function dmMatches(matches: M[], appUrl: string, leagueName: (c: string) => string) {
  const n = matches.length;
  const first = matches.reduce((a, b) => (a.startTime < b.startTime ? a : b));
  const text = n === 1
    ? `⏰ ${short(first.team1)} vs ${short(first.team2)} commence à ${timeFr(first.startTime)} et tu n'as pas pronostiqué.`
    : `⏰ ${n} matchs commencent dans moins d'une heure et tu n'as pas pronostiqué.`;
  return {
    text,
    blocks: [section(`*${text}*\n${matches.map((m) => line(m, leagueName)).join("\n")}`), button(`${appUrl}/matchs`, "Pronostiquer")],
  };
}

export function dmBracket(name: string, lockAt: Date, done: number, total: number, url: string) {
  const text = done === 0
    ? `🏆 Le tableau ${name} ferme à ${timeFr(lockAt)} et tu ne l'as pas rempli.`
    : `🏆 Ton tableau ${name} est incomplet (${done}/${total}) et ferme à ${timeFr(lockAt)}.`;
  return { text, blocks: [section(`*${text}*\nJusqu'à 40 pts pour le bon champion.`), button(url, "Remplir mon tableau")] };
}

export function channelDigest(matches: M[], appUrl: string, leagueName: (c: string) => string) {
  const byLeague = new Map<string, number>();
  matches.forEach((m) => byLeague.set(m.league, (byLeague.get(m.league) ?? 0) + 1));
  const summary = [...byLeague].map(([l, n]) => `${leagueName(l)} ×${n}`).join(" · ");
  const text = `🎮 ${matches.length} match${matches.length > 1 ? "s" : ""} à pronostiquer aujourd'hui (${summary})`;
  const shown = matches.slice(0, 12);
  return {
    text,
    blocks: [
      section(`*${text}*\n${shown.map((m) => line(m, leagueName)).join("\n")}${matches.length > shown.length ? `\n… et ${matches.length - shown.length} autres` : ""}`),
      button(`${appUrl}/matchs`, "Faire mes pronos"),
    ],
  };
}

export type WeeklyRow = { rank: number; displayName: string; points: number };
export type Coup = { displayName: string; team: string; multiplier: number; points: number };

export function channelWeekly(top: WeeklyRow[], coup: Coup | null, appUrl: string) {
  const medals = ["🥇", "🥈", "🥉"];
  const text = "📊 Le classement de la semaine";
  const rows = top.map((r, i) => `${medals[i] ?? `${r.rank}.`} *${r.displayName}* · ${r.points} pts`).join("\n");
  const coupLine = coup ? `\n\n🎯 Coup de la semaine : *${coup.displayName}* a misé sur ${short(coup.team)} contre la majorité (×${String(coup.multiplier).replace(".", ",")}, +${coup.points} pts)` : "";
  return { text, blocks: [section(`*${text}*\n${rows || "Personne n'a encore marqué de points."}${coupLine}`), button(`${appUrl}/classement`, "Voir le classement")] };
}

export function channelBracketOpen(name: string, lockAt: Date, url: string) {
  const d = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(lockAt);
  const text = `🏆 Le tableau ${name} est ouvert !`;
  return { text, blocks: [section(`*${text}*\nRemplis-le avant le ${d} à ${timeFr(lockAt)}. Jusqu'à 40 pts pour le bon champion.`), button(url, "Remplir mon tableau")] };
}
