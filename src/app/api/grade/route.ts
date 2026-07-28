import { NextResponse } from "next/server";
import { gradeSession } from "@/lib/garden";
import type { Turn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nodeId = String(body.nodeId ?? "");
    const mode = String(body.mode ?? "call");
    const transcript: Turn[] = Array.isArray(body.transcript) ? body.transcript : [];

    if (!nodeId) {
      return NextResponse.json({ error: "No node to grade." }, { status: 400 });
    }
    // Need at least one thing the learner actually said.
    if (!transcript.some((t) => t.speaker === "user" && t.text.trim())) {
      return NextResponse.json(
        { error: "There's nothing from you to grade yet — say a little about it first." },
        { status: 400 }
      );
    }

    const { result, garden, provider } = await gradeSession(nodeId, transcript, mode);
    return NextResponse.json({ result, garden, provider });
  } catch (err) {
    console.error("[/api/grade]", err);
    return NextResponse.json(
      { error: "Couldn't tell how that went. Your progress is safe — try the checkpoint again." },
      { status: 502 }
    );
  }
}
