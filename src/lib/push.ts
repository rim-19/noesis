// Web-push setup. VAPID keys come from env; generate them with `npm run vapid`.

import "server-only";
import webpush from "web-push";
import { db } from "./db";
import { wiltingNodes } from "./garden";

const PUBLIC = process.env.VAPID_PUBLIC_KEY?.trim() || "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY?.trim() || "";
const SUBJECT = process.env.VAPID_SUBJECT?.trim() || "mailto:hello@noesis.app";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return !!(PUBLIC && PRIVATE);
}
export function vapidPublicKey(): string {
  return PUBLIC;
}

export async function saveSubscription(userId: string, sub: webpush.PushSubscription): Promise<void> {
  const c = await db();
  await c.execute({
    sql: `INSERT OR REPLACE INTO push_subscriptions (endpoint, user_id, data, created_at) VALUES (?, ?, ?, ?)`,
    args: [sub.endpoint, userId, JSON.stringify(sub), Date.now()],
  });
}

/**
 * For each subscription, check that user's wilting nodes and send one nudge.
 * Prunes dead subscriptions. Returns how many notifications were sent.
 */
export async function runNudges(): Promise<number> {
  if (!ensureConfigured()) return 0;
  const c = await db();
  const rows = (await c.execute("SELECT endpoint, user_id, data FROM push_subscriptions")).rows;
  let sent = 0;
  for (const row of rows) {
    const userId = String(row.user_id);
    const wilting = await wiltingNodes(userId);
    if (wilting.length === 0) continue;
    const topic = wilting[0].topic;
    const payload = {
      title: "Your garden 🌿",
      body:
        wilting.length === 1
          ? `"${topic}" is wilting a little — a quick refresher?`
          : `${wilting.length} nodes are wilting, starting with "${topic}".`,
      url: "/",
    };
    const sub = JSON.parse(String(row.data)) as webpush.PushSubscription;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await c.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [String(row.endpoint)] });
      }
    }
  }
  return sent;
}
