import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { config } from "./config";

// Pas de connexion par email : un joueur = un pseudo, mémorisé par un cookie de session.
// Sur un autre appareil, il se retrouve avec son code de récupération.
export const SESSION_COOKIE = "wlp_session";
export const ADMIN_COOKIE = "wlp_admin";
const SESSION_DAYS = 365;

export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const cookieBase = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Jeton admin dérivé de la clé : le cookie ne contient jamais la clé elle-même. */
export function adminToken(): string | null {
  return config.adminKey.length >= 16 ? hashToken(`admin:${config.adminKey}`) : null;
}

export async function grantAdmin() {
  const t = adminToken();
  if (t) (await cookies()).set(ADMIN_COOKIE, t, { ...cookieBase, maxAge: 365 * 86400 });
}

async function isAdminRequest(): Promise<boolean> {
  const t = adminToken();
  const got = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  return !!t && got.length === t.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(t));
}

export type CurrentUser = { id: string; email: string | null; displayName: string | null; isAdmin: boolean };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const { user } = session;
  return { id: user.id, email: user.email, displayName: user.displayName, isAdmin: await isAdminRequest() };
}

/** Joueur identifié (avec pseudo), sinon page d'accueil. */
export async function requireUser(): Promise<CurrentUser & { displayName: string }> {
  const user = await getCurrentUser();
  if (!user?.displayName) redirect("/bienvenue");
  return user as CurrentUser & { displayName: string };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/matchs");
  return user;
}
