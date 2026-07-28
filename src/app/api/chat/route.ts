import { NextResponse } from "next/server";
import { companionReply } from "@/lib/garden";
import type { Turn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nodeId = String(body.nodeId ?? "");
    const mode = String(body.mode ?? "call");
    const history: Turn[] = Array.isArray(body.history) ? body.history : [];

    if (!nodeId) {
      return NextResponse.json({ error: "No node in focus." }, { status: 400 });
    }

    const { text, provider } = await companionReply(nodeId, history, mode);
    return NextResponse.json({ text, provider });
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { error: "The companion lost the thread for a second. Try again." },
      { status: 502 }
    );
  }
}
