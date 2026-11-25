import { Header } from "./Header";
import type { CurrentUser } from "@/lib/auth";

export function Shell({ user, active, children }: { user: CurrentUser; active?: string; children: React.ReactNode }) {
  return (
    <>
      <Header user={user} active={active} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-wina-line py-6 text-center text-xs text-wina-muted">
        Concours interne réservé aux collaborateurs Winamax · Jeu gratuit, sans mise · Données matchs : Leaguepedia (CC BY-SA)
      </footer>
    </>
  );
}

export function PageTitle({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <div className="skew-tag mb-2 bg-wina-red">{kicker}</div>}
        <h1 className="h-display text-4xl sm:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
