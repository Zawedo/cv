import { Logo } from "@/components/Logo";
import { verifyLogin } from "@/app/actions";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <form action={verifyLogin} className="card w-full max-w-sm space-y-6 p-8 text-center">
        <Logo />
        <p className="text-wina-muted">Dernière étape : confirme ta connexion.</p>
        <input type="hidden" name="token" value={token} />
        <button className="btn-red w-full">Se connecter</button>
      </form>
    </div>
  );
}
