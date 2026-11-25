"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { config, isAllowedEmail, normalizeEmail } from "@/lib/config";
import {
  LOGIN_TOKEN_MINUTES, createSession, destroySession, getCurrentUser, hashToken, randomToken, requireAdmin, requireUser,
} from "@/lib/auth";
import { sendLoginEmail } from "@/lib/mail";
import { isValidScore } from "@/lib/scoring";
import { isLeagueCode } from "@/lib/leagues";
import { settleMatch, syncMatches } from "@/lib/sync";

export type FormState = { ok?: boolean; error?: string; message?: string; devLink?: string };

// ---------- Connexion ----------

export async function requestLogin(_: FormState, form: FormData): Promise<FormState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!isAllowedEmail(email)) {
    return { error: `Accès réservé aux adresses ${config.allowedDomains.map((d) => "@" + d).join(" / ")}.` };
  }
  const recent = await prisma.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 10 * 60e3) } },
  });
  if (recent >= 5) return { error: "Trop de demandes. Réessaie dans quelques minutes." };

  const token = randomToken();
  await prisma.loginToken.create({
    data: { email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60e3) },
  });
  const { devLink } = await sendLoginEmail(email, `${config.appUrl}/auth/verify?token=${token}`);
  return { ok: true, message: `Lien envoyé à ${email}. Vérifie ta boîte mail.`, devLink };
}

/** Consommé via un formulaire (POST) pour éviter que les antivirus mail qui « pré-cliquent » ne brûlent le lien. */
export async function verifyLogin(form: FormData) {
  const token = String(form.get("token") ?? "");
  const row = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date() || !isAllowedEmail(row.email)) {
    redirect("/login?error=lien");
  }
  const claimed = await prisma.loginToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) redirect("/login?error=lien");

  const user = await prisma.user.upsert({ where: { email: row.email }, create: { email: row.email }, update: {} });
  await createSession(user.id);
  redirect(user.displayName ? "/matchs" : "/onboarding");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function setDisplayName(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = String(form.get("displayName") ?? "").trim();
  if (!/^[\p{L}\p{N} _.\-]{3,20}$/u.test(name)) {
    return { error: "3 à 20 caractères : lettres, chiffres, espaces, _ . -" };
  }
  const taken = await prisma.user.findFirst({ where: { displayName: name, NOT: { id: user.id } } });
  if (taken) return { error: "Ce pseudo est déjà pris." };
  await prisma.user.update({ where: { id: user.id }, data: { displayName: name } });
  redirect("/matchs");
}

// ---------- Pronostics ----------

export async function savePrediction(matchId: string, team1Score: number, team2Score: number): Promise<FormState> {
  const user = await requireUser();
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: "Match introuvable." };
  if (match.status !== "UPCOMING" || match.startTime <= new Date()) {
    return { error: "Les pronostics sont fermés pour ce match." };
  }
  if (!isValidScore(match.bestOf, { team1Score, team2Score })) return { error: "Score invalide." };

  await prisma.prediction.upsert({
    where: { userId_matchId: { userId: user.id, matchId } },
    create: { userId: user.id, matchId, team1Score, team2Score },
    update: { team1Score, team2Score },
  });
  revalidatePath("/matchs");
  return { ok: true };
}

export async function setSlackReminders(enabled: boolean): Promise<FormState> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { slackReminders: enabled } });
  revalidatePath("/profil");
  return { ok: true };
}

// ---------- Admin ----------

export async function adminSync(): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await syncMatches();
    revalidatePath("/", "layout");
    return { ok: true, message: `Source : ${r.provider} · ${r.upserted} matchs mis à jour · ${r.settled} pronos recalculés` };
  } catch (e) {
    return { error: `Échec de la synchro : ${(e as Error).message}` };
  }
}

export async function adminSetResult(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("matchId"));
  const status = String(form.get("status"));
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) return { error: "Match introuvable." };
  if (!["UPCOMING", "LIVE", "FINISHED", "CANCELED"].includes(status)) return { error: "Statut invalide." };

  let team1Score: number | null = null;
  let team2Score: number | null = null;
  if (status === "FINISHED") {
    team1Score = Number(form.get("team1Score"));
    team2Score = Number(form.get("team2Score"));
    if (!isValidScore(match.bestOf, { team1Score, team2Score })) return { error: `Score invalide pour un BO${match.bestOf}.` };
  }
  await prisma.match.update({
    where: { id },
    data: { status, team1Score, team2Score, winner: team1Score == null ? null : team1Score > team2Score! ? 1 : 2, manual: true },
  });
  await settleMatch(id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Résultat enregistré et points recalculés." };
}

export async function adminCreateMatch(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const league = String(form.get("league"));
  const team1 = String(form.get("team1") ?? "").trim();
  const team2 = String(form.get("team2") ?? "").trim();
  const bestOf = Number(form.get("bestOf"));
  const startTime = new Date(String(form.get("startTime")));
  if (!isLeagueCode(league)) return { error: "Ligue invalide." };
  if (!team1 || !team2 || team1 === team2) return { error: "Équipes invalides." };
  if (![1, 3, 5].includes(bestOf)) return { error: "BO invalide." };
  if (Number.isNaN(startTime.getTime())) return { error: "Date invalide." };
  await prisma.match.create({
    data: {
      externalId: `manual:${crypto.randomUUID()}`, league, tournament: String(form.get("tournament") || league),
      stage: String(form.get("stage") || "") || null, team1, team2, bestOf, startTime, manual: true,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `${team1} vs ${team2} ajouté.` };
}
