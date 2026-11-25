import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/bienvenue", "/api/cron", "/admin/acces"];

// Filtre rapide : sans cookie de joueur, on envoie vers la page d'accueil (choix du pseudo).
// La validité réelle de la session est vérifiée côté serveur dans chaque page.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.get("wlp_session")) return NextResponse.redirect(new URL("/bienvenue", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|icon.svg).*)"] };
