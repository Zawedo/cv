"use client";
import { useState, useTransition } from "react";
import { setSlackReminders } from "../actions";

export function SlackToggle({ initial }: { initial: boolean }) {
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
    </div>
  );
}
