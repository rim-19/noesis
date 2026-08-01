import { NextResponse } from "next/server";
import { wiltingNodes } from "@/lib/garden";
import { vapidPublicKey } from "@/lib/push";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getUserId();
    const wilting = await wiltingNodes(userId);
    return NextResponse.json({
      wilting: wilting.map((n) => ({ id: n.id, topic: n.topic })),
      vapidPublicKey: vapidPublicKey(),
    });
  } catch (err) {
    console.error("[/api/nudges]", err);
    return NextResponse.json({ wilting: [], vapidPublicKey: "" });
  }
}
