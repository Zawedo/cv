import "server-only";

// Client Slack minimal. Deux modes, indépendants :
//  - SLACK_BOT_TOKEN : messages privés (scopes chat:write, users:read, users:read.email)
//  - SLACK_WEBHOOK_URL (ou SLACK_BOT_TOKEN + SLACK_CHANNEL_ID) : messages sur une chaîne
const API = (process.env.SLACK_API_URL ?? "https://slack.com/api").replace(/\/$/, "");
const token = () => process.env.SLACK_BOT_TOKEN ?? "";

export type SlackMessage = { text: string; blocks?: unknown[] };

export const slackConfig = () => ({
  dm: !!token(),
  channel: !!process.env.SLACK_WEBHOOK_URL || (!!token() && !!process.env.SLACK_CHANNEL_ID),
});

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; [k: string]: unknown };
  return json;
}

/** Identifiant Slack d'un collègue à partir de son email, ou null s'il n'a pas de compte. */
export async function lookupSlackId(email: string): Promise<string | null> {
  const res = await fetch(`${API}/users.lookupByEmail?${new URLSearchParams({ email })}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; user?: { id: string } };
  if (json.ok && json.user) return json.user.id;
  if (json.error === "users_not_found") return null;
  throw new Error(`Slack users.lookupByEmail : ${json.error ?? res.status}`);
}

export async function sendDirectMessage(slackId: string, msg: SlackMessage) {
  const r = await call("chat.postMessage", { channel: slackId, ...msg, unfurl_links: false });
  if (!r.ok) throw new Error(`Slack chat.postMessage : ${r.error}`);
}

export async function postToChannel(msg: SlackMessage) {
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (hook) {
    const res = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) });
    if (!res.ok) throw new Error(`Slack webhook HTTP ${res.status}`);
    return;
  }
  const r = await call("chat.postMessage", { channel: process.env.SLACK_CHANNEL_ID, ...msg, unfurl_links: false });
  if (!r.ok) throw new Error(`Slack chat.postMessage : ${r.error}`);
}
