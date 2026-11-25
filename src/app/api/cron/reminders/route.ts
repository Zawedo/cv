import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { runReminders } from "@/lib/reminders-run";

export const dynamic = "force-dynamic";

// À appeler toutes les 15 min, après la synchro.
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runReminders());
}
