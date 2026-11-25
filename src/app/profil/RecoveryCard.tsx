"use client";
import { useState, useTransition } from "react";
import { regenerateRecovery } from "../actions";
import { CodeReveal } from "@/components/CodeReveal";

export function RecoveryCard() {
  const [code, setCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="card mb-8 p-4">
      <div className="h-display text-xl">Code de récupération</div>
      <p className="mt-1 text-sm text-wina-muted">Il te permet de retrouver ton compte sur un autre appareil (téléphone, autre navigateur). Si tu l&apos;as perdu, génères-en un nouveau : l&apos;ancien ne marchera plus.</p>
      {code ? <div className="mt-3"><CodeReveal code={code} /></div> : confirm ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm">L&apos;ancien code ne marchera plus. Continuer ?</span>
          <button className="btn-red" disabled={pending} onClick={() => start(async () => { const r = await regenerateRecovery(); if (r.code) setCode(r.code); })}>Oui, nouveau code</button>
          <button className="btn-ghost" onClick={() => setConfirm(false)}>Annuler</button>
        </div>
      ) : (
        <button className="btn-ghost mt-3" onClick={() => setConfirm(true)}>Générer un nouveau code</button>
      )}
    </div>
  );
}
