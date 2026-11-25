"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/config";
import { createSession, destroySession, getCurrentUser, requireAdmin, requireUser } from "@/lib/auth";
import { LOCK_MINUTES, MAX_ATTEMPTS, codeMatches, hashCode, newRecoveryCode } from "@/lib/recovery";
import { isValidScore } from "@/lib/scoring";
import { isLeagueCode } from "@/lib/leagues";
import { settleMatch, syncMatches } from "@/lib/sync";

export type FormState = { ok?: boolean; error?: string; message?: string; code?: string };

const PSEUDO = /^[\p{L}\p{N} _.\-]{3,20}$/u;

// ---------- Arrivée sur le site ----------

/** Nouveau joueur : choisit un pseudo, reçoit son code de récupération. */
export async function createPlayer(_: FormState, form: FormData): Promise<FormState> {
  if (await getCurrentUser()) redirect("/matchs");
  const name = String(form.get("displayName") ?? "").trim();
  if (!PSEUDO.test(name)) return { error: "3 à 20 caractères : lettres, chiffres, espaces, _ . -" };
  const taken = await prisma.user.findFirst({ where: { displayName: name } });
  if (taken) return { error: "Ce pseudo est déjà pris. Si c'est le tien, utilise ton code de récupération." };
  const code = newRecoveryCode();
  const user = await prisma.user.create({ data: { displayName: name, recoveryHash: hashCode(code) } });
  await createSession(user.id);
  return { ok: true, code };
}

/** Joueur existant sur un nouvel appareil : pseudo + code de récupération. */
export async function recoverPlayer(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("displayName") ?? "").trim();
  const code = String(form.get("code") ?? "");
  const user = await prisma.user.findFirst({ where: { displayName: name } });
  const wrong = { error: "Pseudo ou code incorrect." };
  if (!user) return wrong;
  if (user.recoveryLockedUntil && user.recoveryLockedUntil > new Date()) {
    return { error: `Trop d'essais. Réessaie dans ${LOCK_MINUTES} minutes.` };
  }
  if (!codeMatches(code, user.recoveryHash)) {
    const fails = user.recoveryFails + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: fails >= MAX_ATTEMPTS ? { recoveryFails: 0, recoveryLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60e3) } : { recoveryFails: fails },
    });
    return wrong;
  }
  await prisma.user.update({ where: { id: user.id }, data: { recoveryFails: 0, recoveryLockedUntil: null } });
  await createSession(user.id);
  redirect("/matchs");
}

/** Nouveau code (l'ancien ne marche plus). Affiché une seule fois. */
export async function regenerateRecovery(): Promise<FormState> {
  const user = await requireUser();
  const code = newRecoveryCode();
  await prisma.user.update({ where: { id: user.id }, data: { recoveryHash: hashCode(code), recoveryFails: 0, recoveryLockedUntil: null } });
  return { ok: true, code };
}

export async function logout() {
  await destroySession();
  redirect("/bienvenue");
}

/** Email facultatif, utilisé seulement pour retrouver le joueur sur Slack. */
export async function setSlackEmail(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = String(form.get("email") ?? "");
  const email = raw.trim() ? normalizeEmail(raw) : null;
  if (email && !isValidEmail(email)) return { error: "Adresse email invalide." };
  if (email) {
    const other = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
    if (other) return { error: "Cette adresse est déjà utilisée par un autre joueur." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { email, slackId: null } });
  revalidatePath("/profil");
  return { ok: true, message: email ? "Email enregistré." : "Email retiré." };
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
