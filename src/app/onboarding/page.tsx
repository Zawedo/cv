import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { NameForm } from "./NameForm";

export default async function Onboarding() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.displayName) redirect("/matchs");
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="card w-full max-w-sm space-y-4 p-8">
        <Logo />
        <h1 className="h-display text-3xl">Choisis ton pseudo</h1>
        <p className="text-sm text-wina-muted">Il apparaîtra dans le classement visible par tous les collègues.</p>
        <NameForm />
      </div>
    </div>
  );
}
