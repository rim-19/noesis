import { NextResponse } from "next/server";
import { saveSubscription, pushConfigured } from "@/lib/push";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: "push-not-configured" }, { status: 503 });
  }
  try {
    const userId = await getUserId();
    const sub = await req.json();
    if (!sub?.endpoint) return NextResponse.json({ error: "bad-subscription" }, { status: 400 });
    await saveSubscription(userId, sub);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/push/subscribe]", err);
    return NextResponse.json({ error: "subscribe-failed" }, { status: 500 });
  }
}
