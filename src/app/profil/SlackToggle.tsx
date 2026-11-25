"use client";
import { useActionState, useState, useTransition } from "react";
import { setSlackEmail, setSlackReminders, type FormState } from "../actions";

export function SlackToggle({ initial, email }: { initial: boolean; email: string | null }) {
  const [state, action, saving] = useActionState<FormState, FormData>(setSlackEmail, {});
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="card mb-8 flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="h-display text-xl">Rappels Slack</div>
        <p className="text-sm text-wina-muted">Un message privé environ 1 h avant un match que tu n&apos;as pas pronostiqué, et 3 h avant la fermeture d&apos;un tableau incomplet.</p>
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={pending} aria-label="Rappels Slack"
        onClick={() => { const v = !on; setOn(v); start(async () => { const r = await setSlackReminders(v); if (r.error) setOn(!v); }); }}
        className={`relative h-8 w-14 shrink-0 transition ${on ? "bg-wina-red" : "bg-wina-line"}`}>
        <span className={`absolute top-1 h-6 w-6 bg-white transition-all ${on ? "left-7" : "left-1"}`} />
      </button>
      {on && (
        <form action={action} className="flex w-full flex-wrap items-center gap-2">
          <label htmlFor="slack-email" className="w-full text-xs text-wina-muted">Ton email Winamax, pour te retrouver sur Slack (il n&apos;est visible par personne)</label>
          <input id="slack-email" name="email" type="email" defaultValue={email ?? ""} placeholder="prenom.nom@winamax.fr" className="input min-w-0 flex-1" />
          <button className="btn-ghost" disabled={saving}>Enregistrer</button>
          {state.error && <p className="w-full text-xs text-wina-red">{state.error}</p>}
          {state.message && <p className="w-full text-xs text-green-400">{state.message}</p>}
          {!email && !state.message && <p className="w-full text-xs text-wina-gold">Sans email, tu ne recevras pas de rappel.</p>}
        </form>
      )}
    </div>
  );
}
