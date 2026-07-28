import { NextResponse } from "next/server";
import { loadGarden } from "@/lib/garden";

export const runtime = "nodejs";

export async function GET() {
  try {
    const garden = await loadGarden();
    return NextResponse.json(garden);
  } catch (err) {
    console.error("[/api/garden]", err);
    return NextResponse.json({ error: "Could not open the garden." }, { status: 500 });
  }
}
