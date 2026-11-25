import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { LEAGUES } from "@/lib/leagues";
import { WelcomeForms } from "./WelcomeForms";

export default async function Bienvenue() {
  // Pas de redirection ici : à la création du compte, la page se recharge et doit pouvoir afficher le code
  const user = await getCurrentUser();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col justify-between gap-8 overflow-hidden bg-wina-red px-5 py-7 sm:p-12">
        <div className="absolute -right-24 top-0 h-full w-72 -skew-x-12 bg-wina-red-dark/60" />
        <Logo size="lg" onRed />
        <div className="relative">
          <h1 className="h-display text-5xl leading-none sm:text-7xl">Pronostique.<br />Grimpe.<br />Domine.</h1>
          <p className="mt-6 max-w-md text-lg text-white/90">
            Le concours de pronos League of Legends réservé aux équipes Winamax. Tous les matchs des ligues majeures, un seul classement.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          {LEAGUES.map((l) => <span key={l.code} className="skew-tag bg-wina-black text-base">{l.name}</span>)}
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-8 sm:p-8">
        <div className="w-full max-w-sm"><WelcomeForms player={user?.displayName ?? null} /></div>
      </section>
    </div>
  );
}
