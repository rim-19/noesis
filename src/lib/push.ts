// Web-push setup. VAPID keys come from env; generate them once with `npm run vapid`.

import "server-only";
import webpush from "web-push";
import { db } from "./db";

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

export async function saveSubscription(sub: webpush.PushSubscription): Promise<void> {
  const c = await db();
  await c.execute({
    sql: `INSERT OR REPLACE INTO push_subscriptions (endpoint, data, created_at) VALUES (?, ?, ?)`,
    args: [sub.endpoint, JSON.stringify(sub), Date.now()],
  });
}

/** Send a notification to every stored subscription; prune dead ones. */
export async function sendToAll(payload: { title: string; body: string; url?: string }): Promise<number> {
  if (!ensureConfigured()) return 0;
  const c = await db();
  const rows = (await c.execute("SELECT endpoint, data FROM push_subscriptions")).rows;
  let sent = 0;
  for (const row of rows) {
    const sub = JSON.parse(String(row.data)) as webpush.PushSubscription;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Subscription expired — remove it.
        await c.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [String(row.endpoint)] });
      }
    }
  }
  return sent;
}
