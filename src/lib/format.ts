const TZ = "Europe/Paris";

export function dayKey(d: Date) {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function dayLabel(d: Date) {
  const s = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function timeLabel(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}
export function teamTag(name: string) {
  const clean = name.replace(/\s*\([^)]*\)\s*$/, "").replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const words = clean.split(/\s+/);
  if (clean.length <= 4) return clean.toUpperCase();
  return (words.length > 1 ? words.map((w) => w[0]).join("") : clean.slice(0, 3)).toUpperCase().slice(0, 4);
}
export function teamColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 32%)`;
}
