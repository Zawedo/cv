import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { config } from "@/lib/config";
import { syncMatches } from "@/lib/sync";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${config.cronSecret}`);
  return config.cronSecret.length >= 16 && got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await syncMatches());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
