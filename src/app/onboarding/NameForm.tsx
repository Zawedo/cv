"use client";
import { useActionState } from "react";
import { setDisplayName, type FormState } from "../actions";

export function NameForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setDisplayName, {});
  return (
    <form action={action} className="space-y-3">
      <input name="displayName" required minLength={3} maxLength={20} placeholder="Ton pseudo" className="input" autoFocus />
      <button className="btn-red w-full" disabled={pending}>C&apos;est parti</button>
      {state.error && <p className="text-sm text-wina-red">{state.error}</p>}
    </form>
  );
}
