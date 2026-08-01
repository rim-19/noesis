import { NextResponse } from "next/server";
import { deleteSubject } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    return NextResponse.json({ garden: await deleteSubject(userId, id) });
  } catch (err) {
    console.error("[/api/subjects DELETE]", err);
    return NextResponse.json({ error: "Couldn't remove that subject." }, { status: 500 });
  }
}
