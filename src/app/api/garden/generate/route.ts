import { NextResponse } from "next/server";
import { generateGraph, addQuickNode } from "@/lib/garden";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const goal = String(body.goal ?? "").trim();
    const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : undefined;
    const source =
      body.source && typeof body.source.text === "string" && body.source.text.trim()
        ? { name: String(body.source.name ?? "your file"), text: String(body.source.text) }
        : undefined;
    const quick = !!body.quick;

    if (!goal) {
      return NextResponse.json({ error: "Tell me what you want to learn first." }, { status: 400 });
    }

    if (quick) {
      const garden = await addQuickNode(goal);
      return NextResponse.json({ garden, provider: "local" });
    }

    const garden = await generateGraph(goal, sourceUrl, source);
    return NextResponse.json(garden);
  } catch (err) {
    console.error("[/api/garden/generate]", err);
    return NextResponse.json(
      { error: "The gardener couldn't shape that into a graph. Try rephrasing the goal." },
      { status: 502 }
    );
  }
}
