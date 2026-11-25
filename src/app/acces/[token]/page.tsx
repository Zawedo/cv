import Link from "next/link";
import { Logo } from "@/components/Logo";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import { redeemAccessLink } from "@/app/actions";

// Page d'un lien d'accès : on confirme d'un clic (un aperçu automatique du lien ne le consomme pas).
export default async function AccesPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { token } = await params;
  const { erreur } = await searchParams;
  const link = await prisma.accessLink.findUnique({ where: { tokenHash: hashToken(decodeURIComponent(token)) }, include: { user: true } });
  const valid = !erreur && link && !link.usedAt && link.expiresAt > new Date();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm space-y-5 p-8">
        <Logo />
        {valid ? (
          <form action={redeemAccessLink} className="space-y-4">
            <h1 className="h-display text-3xl">Retrouver ton compte</h1>
            <p className="text-sm text-wina-muted">Ce lien te connecte sur cet appareil en tant que <b className="text-white">{link!.user.displayName}</b>. Il ne marche qu&apos;une fois.</p>
            <input type="hidden" name="token" value={decodeURIComponent(token)} />
            <button className="btn-red w-full">Continuer en tant que {link!.user.displayName}</button>
          </form>
        ) : (
          <div className="space-y-4">
            <h1 className="h-display text-3xl">Lien expiré</h1>
            <p className="text-sm text-wina-muted">Ce lien d&apos;accès a déjà servi ou n&apos;est plus valable. Demande-en un nouveau à un admin.</p>
            <Link href="/bienvenue" className="btn-ghost w-full">Retour à l&apos;accueil</Link>
          </div>
        )}
      </div>
    </div>
  );
}
