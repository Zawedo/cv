function list(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export const config = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS || "winamax.fr"),
  adminEmails: list(process.env.ADMIN_EMAILS),
  cronSecret: process.env.CRON_SECRET ?? "",
  smtpUrl: process.env.SMTP_URL ?? "",
  mailFrom: process.env.MAIL_FROM ?? "Winamax LoL Pronos <no-reply@winamax.fr>",
  provider: process.env.MATCH_PROVIDER ?? "leaguepedia",
  isProd: process.env.NODE_ENV === "production",
};

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Vérifie que l'email appartient exactement à un domaine autorisé (pas de sous-domaine piégeux). */
export function isAllowedEmail(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+)$/.exec(email);
  if (!m) return false;
  return config.allowedDomains.includes(m[1]);
}

export function isAdminEmail(email: string): boolean {
  return config.adminEmails.includes(email.toLowerCase());
}
