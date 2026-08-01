import { NextResponse } from "next/server";
import { lessonHistory, lessonReply } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 60;

// Load a node's lesson thread.
export async function GET(req: Request) {
  try {
    const userId = await getUserId();
    const nodeId = new URL(req.url).searchParams.get("nodeId") ?? "";
    if (!nodeId) return NextResponse.json({ error: "No node." }, { status: 400 });
    return NextResponse.json({ messages: await lessonHistory(userId, nodeId) });
  } catch (err) {
    console.error("[/api/lesson GET]", err);
    return NextResponse.json({ error: "Couldn't load the lesson." }, { status: 500 });
  }
}

// Send a message (or open the lesson) and get the tutor's next teaching turn.
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => ({}));
    const nodeId = String(body.nodeId ?? "");
    const content = String(body.content ?? "");
    const voice = !!body.voice;
    if (!nodeId) return NextResponse.json({ error: "No node in focus." }, { status: 400 });

    const { message, provider } = await lessonReply(userId, nodeId, content, voice);
    return NextResponse.json({ message, provider });
  } catch (err) {
    console.error("[/api/lesson POST]", err);
    return NextResponse.json({ error: "The tutor lost the thread. Try again." }, { status: 502 });
  }
}
