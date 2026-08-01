import { NextResponse } from "next/server";
import { runNudges } from "@/lib/push";

export const runtime = "nodejs";

/**
 * Scheduled nudge job. Point a scheduler at this (e.g. Vercel Cron daily).
 * Checks every subscribed user's wilting nodes and sends one gentle push each.
 * Optionally protect with CRON_SECRET (?secret=... or Authorization: Bearer ...).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await runNudges();
  return NextResponse.json({ sent });
}
