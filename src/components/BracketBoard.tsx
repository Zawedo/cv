"use client";

import { useMemo, useState, useTransition } from "react";
import { FORMATS, displayTeam, resolve, type BracketFormat, type Picks, type ResolvedNode } from "@/lib/bracket";
import { saveBracket } from "@/app/tableaux/actions";
import { TeamLogo } from "./TeamLogo";

type Props = {
  slug: string;
  format: BracketFormat;
  seeds: string[];
  initialPicks: Picks;
  results: Picks;
  locked: boolean;
  logos: Record<string, string | null>;
};

const SECTIONS = [
  { side: "UB", title: "Tableau des gagnants" },
  { side: "LB", title: "Tableau des perdants" },
  { side: "F", title: "Finale" },
] as const;

function colTitle(format: BracketFormat, n: ResolvedNode) {
  if (format === "SINGLE_ELIM_8") return ["Quarts de finale", "Demi-finales", "Finale"][n.col];
  return n.label.includes("·") ? n.label.split("·")[1].trim() : n.label;
}

export function BracketBoard({ slug, format, seeds, initialPicks, results, locked, logos }: Props) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const { nodes: myNodes, picks: clean } = useMemo(() => resolve(format, seeds, picks), [format, seeds, picks]);
  // Une fois verrouillé : on affiche le vrai déroulé, et le prono de l'utilisateur par-dessus
  const nodes = useMemo(() => {
    if (!locked) return myNodes;
    const actual = resolve(format, seeds, results).nodes;
    return actual.map((a, i) => ({
      ...a,
      teamA: a.teamA ?? myNodes[i].teamA,
      teamB: a.teamB ?? myNodes[i].teamB,
      pick: clean[a.id] ?? null,
    }));
  }, [locked, myNodes, format, seeds, results, clean]);
  const total = FORMATS[format].nodes.length;
  const done = Object.keys(clean).length;

  function choose(nodeId: string, team: string) {
    if (locked) return;
    const next = resolve(format, seeds, { ...clean, [nodeId]: team }).picks;
    const prev = clean;
    setPicks(next);
    setState("saving");
    start(async () => {
      const r = await saveBracket(slug, next);
      if (r.error) { setPicks(prev); setError(r.error); setState("error"); }
      else { setError(null); setState("saved"); }
    });
  }

  const champion = clean[FORMATS[format].final];
  const sections = SECTIONS.map((s) => ({ ...s, nodes: nodes.filter((n) => n.side === s.side) })).filter((s) => s.nodes.length);

  return (
    <div>
      {!locked && (
        <div className="sticky top-[53px] z-10 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-wina-line bg-wina-black/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="h-display text-xl">{done}/{total} <span className="text-wina-muted">choix</span></div>
          <div className="h-1.5 min-w-24 flex-1 bg-wina-line sm:max-w-xs"><div className="h-full bg-wina-red transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>
          <span className="text-xs text-wina-muted">
            {state === "saving" ? "Enregistrement…" : state === "saved" ? "Enregistré ✓" : state === "error" ? <span className="text-wina-red">{error}</span> : "Clique sur l'équipe qui gagne chaque match"}
          </span>
          {champion && <span className="skew-tag ml-auto bg-wina-gold text-black">Ton champion : {displayTeam(champion)}</span>}
        </div>
      )}

      <div className="space-y-8">
        {sections.map((s) => {
          const cols = [...new Set(s.nodes.map((n) => n.col))].sort((a, b) => a - b);
          return (
            <section key={s.side}>
              {format === "DOUBLE_ELIM_8" && <h2 className="h-display mb-3 text-2xl">{s.title}</h2>}
              <div className="flex flex-col gap-6 lg:flex-row lg:gap-4">
                {cols.map((c) => {
                  const col = s.nodes.filter((n) => n.col === c);
                  return (
                    <div key={c} className="flex min-w-0 flex-1 flex-col">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-wina-muted">{colTitle(format, col[0])}</div>
                      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-col lg:justify-around">
                        {col.map((n) => <NodeCard key={n.id} n={n} result={results[n.id]} locked={locked} logos={logos} onPick={choose} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NodeCard({ n, result, locked, logos, onPick }: {
  n: ResolvedNode; result?: string; locked: boolean; logos: Record<string, string | null>; onPick: (id: string, team: string) => void;
}) {
  const isFinal = n.side === "F";
  return (
    <div className={`card ${isFinal ? "border-wina-gold" : ""}`}>
      <div className="flex items-center justify-between border-b border-wina-line px-3 py-1.5 text-[11px] text-wina-muted">
        <span>{n.label}</span><span>{n.pts} pts</span>
      </div>
      {[n.teamA, n.teamB].map((t, i) => {
        const picked = !!t && n.pick === t;
        const won = !!t && result === t;
        const wrong = picked && !!result && result !== t;
        return (
          <button key={i} type="button" disabled={locked || !t} onClick={() => t && onPick(n.id, t)} aria-pressed={picked}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${i ? "border-t border-wina-line" : ""}
              ${picked && !result ? "bg-wina-red" : ""} ${picked && won ? "bg-green-700" : ""} ${wrong ? "bg-wina-red/25" : ""}
              ${!locked && t && !picked ? "hover:bg-wina-line" : ""}`}>
            {t ? <TeamLogo name={t} src={logos[t]} size={28} /> : <span className="h-7 w-7 shrink-0 border border-dashed border-wina-line" />}
            <span className={`h-display min-w-0 flex-1 truncate text-lg ${t ? "" : "text-wina-muted"} ${wrong ? "line-through opacity-70" : ""}`}>
              {t ? displayTeam(t) : "À déterminer"}
            </span>
            {won && <span className="text-xs font-bold text-green-400">✓</span>}
          </button>
        );
      })}
      {locked && n.pick && n.pick !== n.teamA && n.pick !== n.teamB && (
        <div className="border-t border-wina-line px-3 py-1.5 text-xs text-wina-muted">Ton prono : <span className="line-through">{displayTeam(n.pick)}</span></div>
      )}
      {locked && !n.pick && <div className="border-t border-wina-line px-3 py-1.5 text-xs text-wina-muted">Pas de prono</div>}
    </div>
  );
}
