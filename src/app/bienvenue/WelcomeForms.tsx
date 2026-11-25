"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { createPlayer, recoverPlayer, type FormState } from "../actions";
import { CodeReveal } from "@/components/CodeReveal";

export function WelcomeForms({ player }: { player: string | null }) {
  const [mode, setMode] = useState<"new" | "back">("new");
  const [created, create, creating] = useActionState<FormState, FormData>(createPlayer, {});
  const [back, recover, recovering] = useActionState<FormState, FormData>(recoverPlayer, {});

  if (created.code) {
    return (
      <div className="space-y-4">
        <h2 className="h-display text-3xl">C&apos;est parti !</h2>
        <p className="text-sm text-wina-muted">Voici ton code de récupération. Avec ton pseudo, il te permet de retrouver ton compte sur un autre appareil.</p>
        <CodeReveal code={created.code} />
        <Link href="/matchs" className="btn-red w-full">J&apos;ai noté mon code, voir les matchs</Link>
      </div>
    );
  }

  if (player) {
    return (
      <div className="space-y-4">
        <h2 className="h-display text-3xl">Content de te revoir</h2>
        <p className="text-sm text-wina-muted">Tu joues en tant que <b className="text-white">{player}</b> sur cet appareil.</p>
        <Link href="/matchs" className="btn-red w-full">Voir les matchs</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex gap-1">
        <button type="button" onClick={() => setMode("new")} className={`flex-1 ${mode === "new" ? "btn-red" : "btn-ghost"}`}>Nouveau joueur</button>
        <button type="button" onClick={() => setMode("back")} className={`flex-1 ${mode === "back" ? "btn-red" : "btn-ghost"}`}>J&apos;ai déjà un pseudo</button>
      </div>
      {mode === "new" ? (
        <form action={create} className="space-y-3">
          <h2 className="h-display text-3xl">Choisis ton pseudo</h2>
          <p className="text-sm text-wina-muted">Il apparaîtra dans le classement visible par tous les collègues. Pas d&apos;email, pas de mot de passe.</p>
          <label htmlFor="new-name" className="sr-only">Pseudo</label>
          <input id="new-name" name="displayName" required minLength={3} maxLength={20} placeholder="Ton pseudo" autoComplete="nickname" className="input" />
          <button className="btn-red w-full" disabled={creating}>{creating ? "Création…" : "Commencer à jouer"}</button>
          {created.error && <p className="text-sm text-wina-red">{created.error}</p>}
        </form>
      ) : (
        <form action={recover} className="space-y-3">
          <h2 className="h-display text-3xl">Retrouver mon compte</h2>
          <p className="text-sm text-wina-muted">Entre ton pseudo et le code de récupération reçu à ton inscription (ou généré depuis ton profil).</p>
          <label htmlFor="back-name" className="sr-only">Pseudo</label>
          <input id="back-name" name="displayName" required placeholder="Ton pseudo" autoComplete="nickname" className="input" />
          <label htmlFor="back-code" className="sr-only">Code de récupération</label>
          <input id="back-code" name="code" required placeholder="Code (ex. K7QM-4XPA)" autoComplete="off" autoCapitalize="characters" className="input font-mono uppercase tracking-widest" />
          <button className="btn-red w-full" disabled={recovering}>{recovering ? "Vérification…" : "Retrouver mon compte"}</button>
          {back.error && <p className="text-sm text-wina-red">{back.error}</p>}
          <p className="text-xs text-wina-muted">Code perdu ? Si tu es encore connecté sur un autre appareil, génères-en un nouveau depuis ton profil. Sinon, demande à un admin.</p>
        </form>
      )}
    </div>
  );
}
