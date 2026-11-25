import Link from "next/link";
import { Logo } from "./Logo";
import { logout } from "@/app/actions";
import type { CurrentUser } from "@/lib/auth";

const NAV = [
  { href: "/matchs", label: "Matchs" },
  { href: "/classement", label: "Classement" },
  { href: "/profil", label: "Mes pronos" },
];

export function Header({ user, active }: { user: CurrentUser; active?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-wina-red bg-wina-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/matchs"><Logo /></Link>
        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {[...NAV, ...(user.isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`h-display px-3 py-1.5 text-lg ${active === n.href ? "bg-wina-red" : "text-wina-muted hover:text-white"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="font-semibold">{user.displayName}</span>
          <form action={logout}>
            <button className="text-wina-muted hover:text-white" title="Se déconnecter">Déconnexion</button>
          </form>
        </div>
      </div>
    </header>
  );
}
