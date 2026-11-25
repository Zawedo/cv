export const LEAGUES = [
  { code: "LCK", name: "LCK", region: "Corée", color: "#C8102E", leaguepedia: ["LoL Champions Korea"] },
  { code: "LPL", name: "LPL", region: "Chine", color: "#E8B100", leaguepedia: ["Tencent LoL Pro League"] },
  { code: "LEC", name: "LEC", region: "Europe", color: "#00C2C7", leaguepedia: ["LoL EMEA Championship"] },
  {
    code: "LCS",
    name: "LCS",
    region: "Amérique du Nord",
    color: "#0A96FF",
    leaguepedia: ["League of Legends Championship Series", "League of Legends Championship of The Americas North"],
  },
] as const;

export type LeagueCode = (typeof LEAGUES)[number]["code"];

export function isLeagueCode(v: unknown): v is LeagueCode {
  return typeof v === "string" && LEAGUES.some((l) => l.code === v);
}

export function leagueInfo(code: string) {
  return LEAGUES.find((l) => l.code === code);
}
