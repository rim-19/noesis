import { NextResponse } from "next/server";
import { gradeCheckpoint } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => ({}));
    const nodeId = String(body.nodeId ?? "");
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];
    if (!nodeId) return NextResponse.json({ error: "No node to check." }, { status: 400 });
    if (!transcript.some((t: { speaker: string; text: string }) => t.speaker === "user" && t.text?.trim())) {
      return NextResponse.json({ error: "Explain it in your own words first." }, { status: 400 });
    }
    const { result, garden } = await gradeCheckpoint(userId, nodeId, transcript);
    return NextResponse.json({ result, garden });
  } catch (err) {
    console.error("[/api/checkpoint]", err);
    return NextResponse.json({ error: "Couldn't grade that — your progress is safe. Try again." }, { status: 502 });
  }
}
