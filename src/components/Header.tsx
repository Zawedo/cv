import Link from "next/link";
import { Logo } from "./Logo";
import type { CurrentUser } from "@/lib/auth";

const NAV = [
  { href: "/matchs", label: "Matchs", icon: "M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 21 18v3h-3l-1.5-1.5" },
  { href: "/tableaux", label: "Tableaux", icon: "M3 5h5v4H3zM3 15h5v4H3zM16 10h5v4h-5zM8 7h3v10H8M11 12h5" },
  { href: "/classement", label: "Classement", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" },
  { href: "/profil", label: "Mes pronos", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Barre d'onglets fixe en bas de l'écran, uniquement sur téléphone. */
export function BottomNav({ active }: { active?: string }) {
  return (
    <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t-2 border-wina-red bg-wina-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}
          className={`h-display relative flex flex-col items-center gap-0.5 py-2 text-[14px] ${active === n.href ? "text-white before:absolute before:inset-x-1/4 before:-top-0.5 before:h-[3px] before:bg-white" : "text-wina-muted"}`}>
          <Icon d={n.icon} className="h-[22px] w-[22px]" />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header({ user, active }: { user: CurrentUser; active?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-wina-red bg-wina-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2.5 sm:py-3">
        <Link href="/matchs" className="shrink-0"><Logo /></Link>
        <nav className="hidden gap-1 sm:flex">
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
        <Link href="/profil" className="ml-auto flex min-w-0 items-center gap-2 text-sm font-semibold hover:text-wina-red" title="Mon profil">
          <span className="truncate">{user.displayName}</span>
          <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" className="h-5 w-5 shrink-0 text-wina-muted" />
        </Link>
      </div>
    </header>
  );
}
