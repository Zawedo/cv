"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { resolve, type BracketFormat, type Picks } from "@/lib/bracket";

export async function saveBracket(slug: string, picks: Picks): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const b = await prisma.bracket.findUnique({ where: { slug } });
  if (!b) return { error: "Tableau introuvable." };
  if (b.lockAt <= new Date()) return { error: "Le tableau est verrouillé : la phase finale a commencé." };
  if (typeof picks !== "object" || picks === null) return { error: "Choix invalides." };
  const clean = resolve(b.format as BracketFormat, JSON.parse(b.seeds), picks).picks;
  await prisma.bracketPick.upsert({
    where: { userId_bracketId: { userId: user.id, bracketId: b.id } },
    create: { userId: user.id, bracketId: b.id, picks: JSON.stringify(clean) },
    update: { picks: JSON.stringify(clean) },
  });
  revalidatePath("/tableaux");
  return { ok: true };
}
