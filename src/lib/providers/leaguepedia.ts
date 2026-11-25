// Source : API Cargo publique de Leaguepedia (lol.fandom.com), sans clé.
// Doc : https://lol.fandom.com/wiki/Help:Leaguepedia_API
import { LEAGUES, type LeagueCode } from "../leagues.ts";
import type { MatchProvider, ProviderMatch } from "./types.ts";

const API = "https://lol.fandom.com/api.php";
const PAGE = 500;

type Row = {
  MatchId: string;
  Team1: string;
  Team2: string;
  Team1Score: string | null;
  Team2Score: string | null;
  Winner: string | null;
  BestOf: string | null;
  DateTime: string | null;
  Tab: string | null;
  Tournament: string | null;
  League: string;
};

function cargoDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function toLeagueCode(lpLeague: string): LeagueCode | null {
  const l = LEAGUES.find((x) => (x.leaguepedia as readonly string[]).includes(lpLeague));
  return l ? l.code : null;
}

export function mapRow(r: Row, now = new Date()): ProviderMatch | null {
  const league = toLeagueCode(r.League);
  if (!league || !r.MatchId || !r.DateTime || !r.Team1 || !r.Team2) return null;
  if (r.Team1 === "TBD" || r.Team2 === "TBD") return null;
  const startTime = new Date(r.DateTime.replace(" ", "T") + "Z");
  const s1 = r.Team1Score ? Number(r.Team1Score) : null;
  const s2 = r.Team2Score ? Number(r.Team2Score) : null;
  const winner = r.Winner === "1" ? 1 : r.Winner === "2" ? 2 : null;
  const status: ProviderMatch["status"] = winner ? "FINISHED" : startTime <= now ? "LIVE" : "UPCOMING";
  return {
    externalId: `lp:${r.MatchId}`,
    league,
    tournament: r.Tournament ?? league,
    stage: r.Tab || null,
    team1: r.Team1,
    team2: r.Team2,
    bestOf: Number(r.BestOf) || 1,
    startTime,
    status,
    team1Score: winner ? s1 : null,
    team2Score: winner ? s2 : null,
    winner,
  };
}

export const leaguepedia: MatchProvider = {
  name: "leaguepedia",
  async fetchMatches(from, to) {
    const leagues = LEAGUES.flatMap((l) => l.leaguepedia).map((n) => `"${n}"`).join(",");
    const out: ProviderMatch[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const params = new URLSearchParams({
        action: "cargoquery",
        format: "json",
        tables: "MatchSchedule=MS,Tournaments=T",
        join_on: "MS.OverviewPage=T.OverviewPage",
        fields: [
          "MS.MatchId=MatchId", "MS.Team1=Team1", "MS.Team2=Team2", "MS.Team1Score=Team1Score",
          "MS.Team2Score=Team2Score", "MS.Winner=Winner", "MS.BestOf=BestOf", "MS.DateTime_UTC=DateTime",
          "MS.Tab=Tab", "T.Name=Tournament", "T.League=League",
        ].join(","),
        where: `T.League IN (${leagues}) AND MS.DateTime_UTC >= "${cargoDate(from)}" AND MS.DateTime_UTC <= "${cargoDate(to)}"`,
        order_by: "MS.DateTime_UTC ASC",
        limit: String(PAGE),
        offset: String(offset),
      });
      const res = await fetch(`${API}?${params}`, {
        headers: { "User-Agent": "winamax-lol-pronos/1.0 (internal prediction game)" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Leaguepedia HTTP ${res.status}`);
      const json = (await res.json()) as { cargoquery?: { title: Row }[]; error?: { info: string } };
      if (json.error) throw new Error(`Leaguepedia: ${json.error.info}`);
      const rows = json.cargoquery ?? [];
      for (const { title } of rows) {
        const m = mapRow(title);
        if (m) out.push(m);
      }
      if (rows.length < PAGE) break;
    }
    return out;
  },
};
