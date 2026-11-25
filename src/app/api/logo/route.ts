import { prisma } from "@/lib/db";

// Sert les logos depuis notre domaine : Leaguepedia refuse l'affichage direct depuis un autre site.
const cache = new Map<string, { body: ArrayBuffer; type: string; at: number }>();
const TTL = 7 * 864e5;

export async function GET(req: Request) {
  const team = new URL(req.url).searchParams.get("t") ?? "";
  const hit = cache.get(team);
  if (hit && Date.now() - hit.at < TTL) return image(hit.body, hit.type);

  const row = await prisma.team.findUnique({ where: { name: team } });
  if (!row?.logoUrl?.startsWith("https://static.wikia.nocookie.net/")) return new Response(null, { status: 404 });
  const res = await fetch(row.logoUrl, { headers: { "User-Agent": "winamax-lol-pronos/1.0" } });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new Response(null, { status: 404 });
  const body = await res.arrayBuffer();
  cache.set(team, { body, type, at: Date.now() });
  return image(body, type);
}

function image(body: ArrayBuffer, type: string) {
  return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, immutable" } });
}
