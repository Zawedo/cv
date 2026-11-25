import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { grantAdmin } from "@/lib/auth";

// Lien secret : /admin/acces?cle=<ADMIN_KEY> donne les droits admin à ce navigateur.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const got = Buffer.from(url.searchParams.get("cle") ?? "");
  const want = Buffer.from(config.adminKey);
  const ok = config.adminKey.length >= 16 && got.length === want.length && crypto.timingSafeEqual(got, want);
  if (!ok) return new NextResponse("Lien invalide.", { status: 403 });
  await grantAdmin();
  return NextResponse.redirect(new URL("/admin", url));
}
