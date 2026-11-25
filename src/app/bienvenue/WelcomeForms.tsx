"use client";
import { useActionState } from "react";
import Link from "next/link";
import { createPlayer, type FormState } from "../actions";

export function WelcomeForms({ player }: { player: string | null }) {
  const [state, create, creating] = useActionState<FormState, FormData>(createPlayer, {});

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
    <form action={create} className="space-y-3">
      <h2 className="h-display text-3xl">Choisis ton pseudo</h2>
      <p className="text-sm text-wina-muted">Il apparaîtra dans le classement visible par tous les collègues. Pas d&apos;email, pas de mot de passe.</p>
      <label htmlFor="new-name" className="sr-only">Pseudo</label>
      <input id="new-name" name="displayName" required minLength={3} maxLength={20} placeholder="Ton pseudo" autoComplete="nickname" className="input" />
      <button className="btn-red w-full" disabled={creating}>{creating ? "Création…" : "Commencer à jouer"}</button>
      {state.error && <p className="text-sm text-wina-red">{state.error}</p>}
      <p className="pt-3 text-xs text-wina-muted">Tu as déjà joué sur un autre appareil ? Demande un lien d&apos;accès à un admin pour retrouver ton compte.</p>
    </form>
  );
}
