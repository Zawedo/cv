"use client";
import { useState } from "react";

/** Affiche un code de récupération avec un bouton pour le copier. */
export function CodeReveal({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="select-all border border-wina-gold bg-wina-ink px-4 py-2 font-display text-3xl font-extrabold tracking-widest text-wina-gold">{code}</code>
      <button type="button" className="btn-ghost"
        onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true), () => setCopied(false))}>
        {copied ? "Copié ✓" : "Copier"}
      </button>
      <p className="w-full text-xs text-wina-muted">Note-le quelque part (gestionnaire de mots de passe, note sur ton téléphone). Il ne sera plus affiché.</p>
    </div>
  );
}
