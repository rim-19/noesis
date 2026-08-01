import { NextResponse } from "next/server";
import { resetGarden } from "@/lib/garden";
import { getUserId } from "@/lib/user";

export const runtime = "nodejs";

export async function POST() {
  try {
    const userId = await getUserId();
    return NextResponse.json({ garden: await resetGarden(userId) });
  } catch (err) {
    console.error("[/api/garden/reset]", err);
    return NextResponse.json({ error: "Couldn't clear the garden." }, { status: 500 });
  }
}
