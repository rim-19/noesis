import { NextResponse } from "next/server";
import { loadGarden } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getUserId();
    return NextResponse.json(await loadGarden(userId));
  } catch (err) {
    console.error("[/api/garden]", err);
    return NextResponse.json({ error: "Could not open your garden." }, { status: 500 });
  }
}
