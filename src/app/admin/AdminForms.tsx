"use client";
import { useActionState, useState, useTransition } from "react";
import { adminCreateMatch, adminSetResult, adminSync, type FormState } from "../actions";
import { LEAGUES } from "@/lib/leagues";

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p className="text-sm text-wina-red">{s.error}</p>;
  if (s.message) return <p className="text-sm text-green-400">{s.message}</p>;
  return null;
}

export function SyncButton() {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button className="btn-red" disabled={pending} onClick={() => start(async () => setState(await adminSync()))}>
        {pending ? "Synchronisation…" : "Synchroniser les matchs"}
      </button>
      <Msg s={state} />
    </div>
  );
}

export function CreateMatchForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminCreateMatch, {});
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-3">
      <select name="league" className="input">{LEAGUES.map((l) => <option key={l.code}>{l.code}</option>)}</select>
      <input name="team1" placeholder="Équipe 1" className="input" required />
      <input name="team2" placeholder="Équipe 2" className="input" required />
      <select name="bestOf" className="input" defaultValue="3"><option value="1">BO1</option><option value="3">BO3</option><option value="5">BO5</option></select>
      <input name="startTime" type="datetime-local" className="input" required />
      <input name="stage" placeholder="Phase (ex. Semaine 3)" className="input" />
      <button className="btn-red sm:col-span-3" disabled={pending}>Ajouter le match</button>
      <div className="sm:col-span-3"><Msg s={state} /></div>
    </form>
  );
}

export function ResultForm({ id, bestOf, status, s1, s2 }: { id: string; bestOf: number; status: string; s1: number | null; s2: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(adminSetResult, {});
  const max = Math.ceil(bestOf / 2);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="matchId" value={id} />
      <select name="status" defaultValue={status} className="bg-wina-ink border border-wina-line px-2 py-1 text-sm">
        <option value="UPCOMING">À venir</option><option value="LIVE">Live</option>
        <option value="FINISHED">Terminé</option><option value="CANCELED">Annulé</option>
      </select>
      <input name="team1Score" type="number" min={0} max={max} defaultValue={s1 ?? ""} className="w-14 bg-wina-ink border border-wina-line px-2 py-1 text-sm" />
      <input name="team2Score" type="number" min={0} max={max} defaultValue={s2 ?? ""} className="w-14 bg-wina-ink border border-wina-line px-2 py-1 text-sm" />
      <button className="bg-wina-line px-3 py-1 text-sm hover:bg-wina-red" disabled={pending}>OK</button>
      <Msg s={state} />
    </form>
  );
}
