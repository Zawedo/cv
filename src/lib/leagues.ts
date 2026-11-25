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
  { code: "MSI", name: "MSI", region: "International", color: "#7C5CFF", leaguepedia: ["Mid-Season Invitational"], international: true },
  { code: "WORLDS", name: "Worlds", region: "International", color: "#C89B3C", leaguepedia: ["World Championship"], international: true },
] as const;

export type LeagueCode = (typeof LEAGUES)[number]["code"];

export function isLeagueCode(v: unknown): v is LeagueCode {
  return typeof v === "string" && LEAGUES.some((l) => l.code === v);
}

export function leagueInfo(code: string) {
  return LEAGUES.find((l) => l.code === code);
}

export function leagueName(code: string) {
  return leagueInfo(code)?.name ?? code;
}

export const INTERNATIONAL = LEAGUES.filter((l) => "international" in l).map((l) => l.code) as LeagueCode[];
