import crypto from "node:crypto";
import { config } from "./config";

/** Vérifie l'en-tête Authorization: Bearer <CRON_SECRET> (16 caractères minimum). */
export function isCronAuthorized(req: Request) {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${config.cronSecret}`);
  return config.cronSecret.length >= 16 && got.length === want.length && crypto.timingSafeEqual(got, want);
}
