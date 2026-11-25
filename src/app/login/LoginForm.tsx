"use client";
import { useActionState } from "react";
import { requestLogin, type FormState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestLogin, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm text-wina-muted" htmlFor="email">Ton adresse email Winamax</label>
      <input id="email" name="email" type="email" required autoComplete="email" placeholder="prenom.nom@winamax.fr" className="input" />
      <button className="btn-red w-full" disabled={pending}>{pending ? "Envoi…" : "Recevoir mon lien de connexion"}</button>
      {state.error && <p className="text-sm text-wina-red">{state.error}</p>}
      {state.message && <p className="text-sm text-green-400">{state.message}</p>}
      {state.devLink && (
        <p className="break-all text-xs text-wina-muted">
          Mode dev (pas de SMTP) : <a className="underline" href={state.devLink}>ouvrir le lien</a>
        </p>
      )}
    </form>
  );
}
