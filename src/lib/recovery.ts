// Code de récupération d'un joueur (pas d'email ni de mot de passe). Pur et testable.
import crypto from "node:crypto";

// Sans 0/O, 1/I/L : lisible à l'écran et facile à recopier
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function newRecoveryCode(): string {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Tolère minuscules, espaces et tiret oublié. */
export function normalizeCode(input: string): string {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(`wlp-recovery:${normalizeCode(code)}`).digest("hex");
}

export function codeMatches(input: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashCode(input)), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
