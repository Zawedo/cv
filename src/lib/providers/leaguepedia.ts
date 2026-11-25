// Source : API publique de Leaguepedia (lol.fandom.com), sans clé.
// Doc : https://lol.fandom.com/wiki/Help:Leaguepedia_API
import { LEAGUES, type LeagueCode } from "../leagues.ts";
import type { MatchProvider, ProviderBracketRow, ProviderMatch } from "./types.ts";

const API = "https://lol.fandom.com/api.php";
const PAGE = 500;
const HEADERS = { "User-Agent": "winamax-lol-pronos/1.0 (internal prediction game)" };

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
  N: string | null;
  Tournament: string | null;
  OverviewPage: string | null;
  League: string;
};

const FIELDS = [
  "MS.MatchId=MatchId", "MS.Team1=Team1", "MS.Team2=Team2", "MS.Team1Score=Team1Score", "MS.Team2Score=Team2Score",
  "MS.Winner=Winner", "MS.BestOf=BestOf", "MS.DateTime_UTC=DateTime", "MS.Tab=Tab", "MS.N_MatchInTab=N",
  "T.Name=Tournament", "T.OverviewPage=OverviewPage", "T.League=League",
].join(",");

function cargoDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function toLeagueCode(lpLeague: string): LeagueCode | null {
  const l = LEAGUES.find((x) => (x.leaguepedia as readonly string[]).includes(lpLeague));
  return l ? l.code : null;
}

const isTbd = (t: string | null | undefined) => !t || t === "TBD" || t === "TBA";

async function api(params: Record<string, string>) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: "json", ...params })}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Leaguepedia HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Leaguepedia: ${json.error.info}`);
  return json;
}

/** Tous les matchs des ligues suivies entre deux dates (qualifications et promotions exclues, play-in des Worlds inclus). */
async function scheduleRows(from: Date, to: Date, extraWhere = ""): Promise<Row[]> {
  const leagues = LEAGUES.flatMap((l) => l.leaguepedia).map((n) => `"${n}"`).join(",");
  const out: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const json = await api({
      action: "cargoquery",
      tables: "MatchSchedule=MS,Tournaments=T",
      join_on: "MS.OverviewPage=T.OverviewPage",
      fields: FIELDS,
      where: `T.League IN (${leagues}) AND (T.IsQualifier="0" OR T.IsQualifier IS NULL OR T.Name LIKE "Worlds %")`
        + ` AND MS.DateTime_UTC >= "${cargoDate(from)}" AND MS.DateTime_UTC <= "${cargoDate(to)}"${extraWhere}`,
      order_by: "MS.DateTime_UTC ASC",
      limit: String(PAGE),
      offset: String(offset),
    });
    const rows = ((json.cargoquery ?? []) as { title: Row }[]).map((r) => r.title);
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function parseDate(s: string) {
  return new Date(s.replace(" ", "T") + "Z");
}

export function mapRow(r: Row, now = new Date()): ProviderMatch | null {
  const league = toLeagueCode(r.League);
  if (!league || !r.MatchId || !r.DateTime || isTbd(r.Team1) || isTbd(r.Team2)) return null;
  const startTime = parseDate(r.DateTime);
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

const BRACKET_TABS = ["Quarterfinals", "Semifinals", "Finals", "Bracket Round 1", "Bracket Round 2", "Bracket Round 3", "Bracket Round 4"];

export const leaguepedia: MatchProvider = {
  name: "leaguepedia",

  async fetchMatches(from, to) {
    return (await scheduleRows(from, to)).map((r) => mapRow(r)).filter((m): m is ProviderMatch => m !== null);
  },

  async fetchBracketRows(from, to) {
    const tabs = BRACKET_TABS.map((t) => `"${t}"`).join(",");
    const rows = await scheduleRows(from, to, ` AND T.League IN ("Mid-Season Invitational","World Championship") AND MS.Tab IN (${tabs})`);
    const out: ProviderBracketRow[] = [];
    for (const r of rows) {
      const league = toLeagueCode(r.League);
      if (!league || !r.DateTime || !r.Tab || !r.N || !r.OverviewPage) continue;
      out.push({
        tournamentKey: r.OverviewPage,
        tournament: r.Tournament ?? r.OverviewPage,
        league,
        tab: r.Tab,
        n: Number(r.N),
        team1: isTbd(r.Team1) ? null : r.Team1,
        team2: isTbd(r.Team2) ? null : r.Team2,
        winner: r.Winner === "1" ? 1 : r.Winner === "2" ? 2 : null,
        startTime: parseDate(r.DateTime),
      });
    }
    return out;
  },

  /** URL d'une vignette 96 px du logo carré de chaque équipe (null si Leaguepedia n'en a pas). */
  async fetchLogos(teams) {
    const out: Record<string, string | null> = {};
    for (let i = 0; i < teams.length; i += 40) {
      const batch = teams.slice(i, i + 40);
      const files = new Map(batch.map((t) => [`File:${t}logo square.png`, t]));
      const json = await api({ action: "query", prop: "imageinfo", iiprop: "url", iiurlwidth: "96", titles: [...files.keys()].join("|") });
      // MediaWiki normalise les titres (ex. « _ » → espace) : on garde la correspondance
      const norm = new Map<string, string>(((json.query?.normalized ?? []) as { from: string; to: string }[]).map((n) => [n.to, n.from]));
      for (const t of batch) out[t] = null;
      for (const page of Object.values(json.query?.pages ?? {}) as { title: string; imageinfo?: { thumburl?: string; url?: string }[] }[]) {
        const team = files.get(norm.get(page.title) ?? page.title);
        const info = page.imageinfo?.[0];
        if (team && info) out[team] = info.thumburl ?? info.url ?? null;
      }
    }
    return out;
  },
};
