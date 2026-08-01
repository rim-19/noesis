import { NextResponse } from "next/server";
import { generateSubject } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => ({}));
    const goal = String(body.goal ?? "").trim();
    const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : undefined;
    const source =
      body.source && typeof body.source.text === "string" && body.source.text.trim()
        ? { name: String(body.source.name ?? "your file"), text: String(body.source.text) }
        : undefined;

    if (!goal) {
      return NextResponse.json({ error: "Tell me what you want to learn first." }, { status: 400 });
    }

    const { garden, subjectId } = await generateSubject(userId, goal, sourceUrl, source);
    return NextResponse.json({ garden, subjectId });
  } catch (err) {
    console.error("[/api/garden/generate]", err);
    return NextResponse.json(
      { error: "Couldn't shape that into a path. Try rephrasing the goal." },
      { status: 502 }
    );
  }
}
