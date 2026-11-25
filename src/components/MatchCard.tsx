"use client";

import { useState, useTransition } from "react";
import { savePrediction } from "@/app/actions";
import { TeamBadge } from "./TeamBadge";
import { maxPoints, scoreOptions, winnerOf } from "@/lib/scoring";

export type MatchCardData = {
  id: string;
  league: string;
  leagueColor: string;
  tournament: string;
  stage: string | null;
  team1: string;
  team2: string;
  bestOf: number;
  time: string;
  status: string;
  locked: boolean;
  team1Score: number | null;
  team2Score: number | null;
  pick: { team1Score: number; team2Score: number; points: number | null; exact: boolean | null } | null;
  community: { total: number; team1Pct: number } | null;
};

export function MatchCard({ m }: { m: MatchCardData }) {
  const [pick, setPick] = useState(m.pick);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const finished = m.status === "FINISHED";
  const canceled = m.status === "CANCELED";

  function choose(t1: number, t2: number) {
    if (m.locked) return;
    const prev = pick;
    setPick({ team1Score: t1, team2Score: t2, points: null, exact: null });
    setError(null);
    start(async () => {
      const r = await savePrediction(m.id, t1, t2);
      if (r.error) { setPick(prev); setError(r.error); }
    });
  }

  const pickedWinner = pick ? winnerOf(pick) : null;
  const realWinner = finished && m.team1Score != null ? (m.team1Score > m.team2Score! ? 1 : 2) : null;

  return (
    <article className={`card relative overflow-hidden ${pick && !finished ? "border-l-4 border-l-wina-red" : ""}`}>
      <div className="flex items-center gap-2 border-b border-wina-line px-4 py-2 text-xs text-wina-muted">
        <span className="skew-tag text-white" style={{ background: m.leagueColor }}>{m.league}</span>
        <span className="truncate">{m.stage ?? m.tournament}</span>
        <span className="ml-auto font-semibold text-white">{m.time}</span>
        <span>BO{m.bestOf}</span>
        {m.status === "LIVE" && <span className="skew-tag animate-pulse bg-wina-red text-white">Live</span>}
        {canceled && <span className="skew-tag bg-wina-line text-white">Annulé</span>}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
        <Team name={m.team1} picked={pickedWinner === 1} won={realWinner === 1} lost={realWinner === 2} />
        <div className="h-display text-center text-3xl">
          {finished ? <span>{m.team1Score}<span className="mx-1 text-wina-muted">-</span>{m.team2Score}</span> : <span className="text-wina-muted text-xl">VS</span>}
        </div>
        <Team name={m.team2} right picked={pickedWinner === 2} won={realWinner === 2} lost={realWinner === 1} />
      </div>

      {!canceled && (
        <div className="px-4 pb-4">
          <div className={`grid gap-1.5 ${m.bestOf === 1 ? "grid-cols-2" : m.bestOf === 3 ? "grid-cols-4" : "grid-cols-6"}`}>
            {scoreOptions(m.bestOf).map((o) => {
              const selected = pick?.team1Score === o.team1Score && pick?.team2Score === o.team2Score;
              const label = m.bestOf === 1 ? (o.team1Score ? m.team1 : m.team2) : `${o.team1Score}-${o.team2Score}`;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={m.locked || pending}
                  onClick={() => choose(o.team1Score, o.team2Score)}
                  className={`h-display truncate py-2 text-lg transition ${
                    selected ? "bg-wina-red text-white" : "bg-wina-ink text-wina-muted enabled:hover:bg-wina-line enabled:hover:text-white"
                  } ${m.locked && !selected ? "opacity-40" : ""}`}
                  aria-pressed={selected}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-wina-muted">
            {finished && pick && pick.points != null ? (
              <span className={`skew-tag ${pick.points > 0 ? (pick.exact ? "bg-wina-gold text-black" : "bg-green-600 text-white") : "bg-wina-line text-white"}`}>
                {pick.points > 0 ? `+${pick.points} pts${pick.exact ? " · score exact" : ""}` : "0 pt"}
              </span>
            ) : !m.locked ? (
              <span>{pick ? (pending ? "Enregistrement…" : "Prono enregistré ✓ – modifiable jusqu'au début") : `Jusqu'à ${maxPoints(m.bestOf)} pts en jeu`}</span>
            ) : !pick ? (
              <span>Pas de prono</span>
            ) : (
              <span>Pronos fermés</span>
            )}
            {m.community && m.community.total > 0 && (
              <span className="ml-auto flex items-center gap-2">
                <span>{m.community.total} prono{m.community.total > 1 ? "s" : ""}</span>
                <span className="flex h-1.5 w-24 overflow-hidden bg-wina-line">
                  <span className="bg-wina-red" style={{ width: `${m.community.team1Pct}%` }} />
                </span>
                <span>{m.community.team1Pct}% / {100 - m.community.team1Pct}%</span>
              </span>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-wina-red">{error}</p>}
        </div>
      )}
    </article>
  );
}

function Team({ name, right, picked, won, lost }: { name: string; right?: boolean; picked: boolean; won: boolean; lost: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${right ? "flex-row-reverse text-right" : ""} ${lost ? "opacity-50" : ""}`}>
      <TeamBadge name={name} />
      <div className="min-w-0">
        <div className="h-display truncate text-xl sm:text-2xl">{name}</div>
        {picked && <div className="text-xs font-semibold text-wina-red">Ton choix</div>}
        {won && !picked && <div className="text-xs text-green-400">Vainqueur</div>}
      </div>
    </div>
  );
}
