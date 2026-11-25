import type { LeagueCode } from "../leagues";

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

export interface MatchProvider {
  name: string;
  fetchMatches(from: Date, to: Date): Promise<ProviderMatch[]>;
}
