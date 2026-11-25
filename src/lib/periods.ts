// Périodes de classement : mois civils et splits de la saison LoL (heure de Paris). Pur et testable.

export type PeriodKind = "mois" | "split";
export type Period = { id: string; kind: PeriodKind; label: string; short: string; from: Date; to: Date };

/** Découpage de la saison (mois/jour de début). À ajuster si Riot change le calendrier. */
export const SPLITS = [
  { n: 1, name: "Split 1", start: [1, 1] },
  { n: 2, name: "Split 2", start: [4, 1] }, // MSI inclus
  { n: 3, name: "Split 3", start: [7, 21] },
  { n: 4, name: "Worlds", start: [10, 1] }, // Worlds et intersaison
] as const;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Minuit à Paris pour une date du calendrier. */
export function parisMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
  );
  const asParis = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asParis - guess));
}

function parisYmd(d: Date) {
  const [y, m, day] = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-").map(Number);
  return { y, m, d: day };
}

export function monthPeriod(y: number, m: number): Period {
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const name = MONTHS[m - 1];
  return { id: `m-${y}-${String(m).padStart(2, "0")}`, kind: "mois", label: `${name[0].toUpperCase()}${name.slice(1)} ${y}`, short: name, from: parisMidnight(y, m, 1), to: parisMidnight(ny, nm, 1) };
}

export function splitPeriod(y: number, n: number): Period {
  const s = SPLITS[n - 1];
  const next = n === SPLITS.length ? { y: y + 1, start: SPLITS[0].start } : { y, start: SPLITS[n].start };
  return { id: `s-${y}-${n}`, kind: "split", label: `${s.name} ${y}`, short: s.name, from: parisMidnight(y, s.start[0], s.start[1]), to: parisMidnight(next.y, next.start[0], next.start[1]) };
}

export function periodOf(kind: PeriodKind, date: Date): Period {
  const { y, m, d } = parisYmd(date);
  if (kind === "mois") return monthPeriod(y, m);
  let n = 1;
  SPLITS.forEach((s, i) => { if (m > s.start[0] || (m === s.start[0] && d >= s.start[1])) n = i + 1; });
  return splitPeriod(y, n);
}

export function parsePeriod(id: string | undefined): Period | null {
  const mm = /^m-(\d{4})-(\d{2})$/.exec(id ?? "");
  if (mm && +mm[2] >= 1 && +mm[2] <= 12) return monthPeriod(+mm[1], +mm[2]);
  const ss = /^s-(\d{4})-([1-4])$/.exec(id ?? "");
  if (ss) return splitPeriod(+ss[1], +ss[2]);
  return null;
}

export function shiftPeriod(p: Period, delta: -1 | 1): Period {
  const [, y, n] = p.id.split("-").map(Number);
  if (p.kind === "mois") {
    const idx = y * 12 + (n - 1) + delta;
    return monthPeriod(Math.floor(idx / 12), (idx % 12) + 1);
  }
  const idx = y * SPLITS.length + (n - 1) + delta;
  return splitPeriod(Math.floor(idx / SPLITS.length), (idx % SPLITS.length) + 1);
}

/** Périodes terminées entre deux dates (pour les badges « champion du mois » / « podium de split »). */
export function completedPeriods(kind: PeriodKind, since: Date, now: Date): Period[] {
  const out: Period[] = [];
  for (let p = periodOf(kind, since); p.to <= now; p = shiftPeriod(p, 1)) out.push(p);
  return out;
}
