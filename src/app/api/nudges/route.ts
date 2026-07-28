import { NextResponse } from "next/server";
import { wiltingNodes } from "@/lib/garden";
import { vapidPublicKey } from "@/lib/push";

export const runtime = "nodejs";

/** In-app nudge feed: which nodes are wilting, plus the VAPID key for push opt-in. */
export async function GET() {
  try {
    const wilting = await wiltingNodes();
    return NextResponse.json({
      wilting: wilting.map((n) => ({ id: n.id, topic: n.topic })),
      vapidPublicKey: vapidPublicKey(),
    });
  } catch (err) {
    console.error("[/api/nudges]", err);
    return NextResponse.json({ wilting: [], vapidPublicKey: "" });
  }
}
