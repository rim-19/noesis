import { NextResponse } from "next/server";
import { wiltingNodes } from "@/lib/garden";
import { sendToAll } from "@/lib/push";

export const runtime = "nodejs";

/**
 * Scheduled nudge job. Point a scheduler at this (e.g. Vercel Cron daily, or any
 * uptime pinger). Finds wilting nodes and sends one gentle push. Optionally
 * protect with CRON_SECRET (?secret=... or Authorization: Bearer ...).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const wilting = await wiltingNodes();
  if (wilting.length === 0) {
    return NextResponse.json({ sent: 0, wilting: 0 });
  }

  const topic = wilting[0].topic;
  const body =
    wilting.length === 1
      ? `“${topic}” is wilting a little — a quick 2-min refresher?`
      : `${wilting.length} of your nodes are wilting — starting with “${topic}”. A quick refresher?`;

  const sent = await sendToAll({ title: "Your garden 🌿", body, url: "/" });
  return NextResponse.json({ sent, wilting: wilting.length });
}
