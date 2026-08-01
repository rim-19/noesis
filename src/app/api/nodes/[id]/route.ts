import { NextResponse } from "next/server";
import { deleteNode, renameNode } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    return NextResponse.json({ garden: await deleteNode(userId, id) });
  } catch (err) {
    console.error("[/api/nodes DELETE]", err);
    return NextResponse.json({ error: "Couldn't remove that." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    if (!topic) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
    return NextResponse.json({ garden: await renameNode(userId, id, topic) });
  } catch (err) {
    console.error("[/api/nodes PATCH]", err);
    return NextResponse.json({ error: "Couldn't rename that." }, { status: 500 });
  }
}
