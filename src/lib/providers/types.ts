import type { LeagueCode } from "../leagues.ts";

export type ProviderMatch = {
  externalId: string;
  league: LeagueCode;
  tournament: string;
  stage: string | null;
  team1: string;
  team2: string;
  bestOf: number;
  startTime: Date;
  status: "UPCOMING" | "LIVE" | "FINISHED" | "CANCELED";
  team1Score: number | null;
  team2Score: number | null;
  winner: 1 | 2 | null;
};

/** Match d'une phase finale internationale, positionné dans son tableau. */
export type ProviderBracketRow = {
  tournamentKey: string;
  tournament: string;
  league: LeagueCode;
  tab: string;
  n: number;
  team1: string | null;
  team2: string | null;
  winner: 1 | 2 | null;
  startTime: Date;
};

export interface MatchProvider {
  name: string;
  fetchMatches(from: Date, to: Date): Promise<ProviderMatch[]>;
  fetchBracketRows(from: Date, to: Date): Promise<ProviderBracketRow[]>;
  fetchLogos(teams: string[]): Promise<Record<string, string | null>>;
}
