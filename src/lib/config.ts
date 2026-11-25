export const config = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Clé du lien admin : /admin/acces?cle=<ADMIN_KEY> (16 caractères minimum) */
  adminKey: process.env.ADMIN_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  provider: process.env.MATCH_PROVIDER ?? "leaguepedia",
  isProd: process.env.NODE_ENV === "production",
};

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
