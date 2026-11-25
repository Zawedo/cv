import "server-only";
import { prisma } from "./db";
import { config } from "./config";
import { leagueName } from "./leagues";
import { FORMATS, resolve, type BracketFormat } from "./bracket";
import { winnerOf } from "./scoring";
import { leaderboard } from "./queries";
import { lookupSlackId, postToChannel, sendDirectMessage, slackConfig, type SlackMessage } from "./slack";
import {
  DM_BRACKET_WINDOW_H, channelBracketOpen, channelDigest, channelSlot, channelWeekly, closingSoon, dmBracket, dmMatches, parisClock,
} from "./reminders";

const ACTIVE_DAYS = 30; // on ne relance que les joueurs actifs récemment

async function logged(keys: string[]) {
  const rows = await prisma.reminderLog.findMany({ where: { key: { in: keys } }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}
async function log(keys: string[]) {
  for (const key of keys) await prisma.reminderLog.upsert({ where: { key }, create: { key }, update: {} });
}

/** Slack ID du joueur, retrouvé une fois via son email puis mémorisé ("" = pas de compte Slack). */
async function slackIdOf(u: { id: string; email: string | null; slackId: string | null }) {
  if (u.slackId !== null) return u.slackId || null;
  if (!u.email) return null;
  const id = await lookupSlackId(u.email);
  await prisma.user.update({ where: { id: u.id }, data: { slackId: id ?? "" } });
  return id;
}

export async function runReminders(now = new Date()) {
  const slack = slackConfig();
  const out = { dmMatches: 0, dmBrackets: 0, channel: [] as string[], errors: [] as string[] };
  if (!slack.dm && !slack.channel) return { ...out, skipped: "Slack non configuré" };

  const upcoming = await prisma.match.findMany({ where: { status: "UPCOMING", startTime: { gt: now } }, orderBy: { startTime: "asc" } });
  const openBrackets = await prisma.bracket.findMany({ where: { lockAt: { gt: now } } });

  // ---------- Messages privés
  if (slack.dm) {
    const users = await prisma.user.findMany({
      where: {
        slackReminders: true, displayName: { not: null }, email: { not: null }, // l'email sert à retrouver le compte Slack
        OR: [{ createdAt: { gt: new Date(now.getTime() - ACTIVE_DAYS * 864e5) } }, { predictions: { some: { updatedAt: { gt: new Date(now.getTime() - ACTIVE_DAYS * 864e5) } } } }],
      },
      select: { id: true, email: true, slackId: true },
    });
    const soon = closingSoon(upcoming, now);
    const closingBrackets = openBrackets.filter((b) => b.lockAt.getTime() <= now.getTime() + DM_BRACKET_WINDOW_H * 36e5);

    if (users.length && (soon.length || closingBrackets.length)) {
      const [preds, bpicks] = await Promise.all([
        prisma.prediction.findMany({ where: { matchId: { in: soon.map((m) => m.id) } }, select: { userId: true, matchId: true } }),
        prisma.bracketPick.findMany({ where: { bracketId: { in: closingBrackets.map((b) => b.id) } } }),
      ]);
      const has = new Set(preds.map((p) => `${p.userId}:${p.matchId}`));
      for (const u of users) {
        try {
          // Matchs qui commencent dans l'heure, sans prono, jamais rappelés à ce joueur
          const missing = soon.filter((m) => !has.has(`${u.id}:${m.id}`));
          const keys = missing.map((m) => `dm:${u.id}:${m.id}`);
          const done = await logged(keys);
          const toSend = missing.filter((m, i) => !done.has(keys[i]));
          const sends: { msg: SlackMessage; keys: string[]; kind: "m" | "b" }[] = [];
          if (toSend.length) sends.push({ msg: dmMatches(toSend, config.appUrl, leagueName), keys: toSend.map((m) => `dm:${u.id}:${m.id}`), kind: "m" });
          // Tableaux incomplets qui ferment bientôt
          for (const b of closingBrackets) {
            const key = `dmb:${u.id}:${b.slug}`;
            const format = b.format as BracketFormat;
            const p = bpicks.find((x) => x.userId === u.id && x.bracketId === b.id);
            const n = p ? Object.keys(resolve(format, JSON.parse(b.seeds), JSON.parse(p.picks)).picks).length : 0;
            const total = FORMATS[format].nodes.length;
            if (n < total && !(await logged([key])).size) sends.push({ msg: dmBracket(b.name, b.lockAt, n, total, `${config.appUrl}/tableaux/${b.slug}`), keys: [key], kind: "b" });
          }
          if (!sends.length) continue;
          const sid = await slackIdOf(u);
          if (!sid) { for (const s of sends) await log(s.keys); continue; } // pas de compte Slack : on n'insiste pas
          for (const s of sends) {
            await sendDirectMessage(sid, s.msg);
            await log(s.keys);
            if (s.kind === "m") out.dmMatches++; else out.dmBrackets++;
          }
        } catch (e) {
          out.errors.push(`${u.email} : ${(e as Error).message}`);
        }
      }
    }
  }

  // ---------- Chaîne
  if (slack.channel) {
    const slot = channelSlot(now);
    const post = async (key: string, build: () => Promise<SlackMessage | null>) => {
      if ((await logged([key])).size) return;
      try {
        const msg = await build();
        if (msg) { await postToChannel(msg); out.channel.push(key); }
        await log([key]);
      } catch (e) { out.errors.push(`${key} : ${(e as Error).message}`); }
    };

    if (slot.digestKey) await post(slot.digestKey, async () => {
      const today = upcoming.filter((m) => parisClock(m.startTime).ymd === slot.ymd);
      return today.length ? channelDigest(today, config.appUrl, leagueName) : null;
    });

    if (slot.weeklyKey) await post(slot.weeklyKey, async () => {
      const top = (await leaderboard()).filter((r) => r.points > 0).slice(0, 5);
      const best = await prisma.prediction.findFirst({
        where: { multiplier: { gt: 1 }, points: { gt: 0 }, match: { startTime: { gt: new Date(now.getTime() - 7 * 864e5) } } },
        orderBy: [{ multiplier: "desc" }, { points: "desc" }],
        include: { user: true, match: true },
      });
      const coup = best?.user.displayName
        ? { displayName: best.user.displayName, team: winnerOf(best) === 1 ? best.match.team1 : best.match.team2, multiplier: best.multiplier!, points: best.points! }
        : null;
      return channelWeekly(top, coup, config.appUrl);
    });

    for (const b of openBrackets) {
      await post(`bracket-open:${b.slug}`, async () => channelBracketOpen(b.name, b.lockAt, `${config.appUrl}/tableaux/${b.slug}`));
    }
  }
  return out;
}
