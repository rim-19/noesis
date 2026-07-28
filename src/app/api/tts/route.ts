import { NextResponse } from "next/server";

export const runtime = "nodejs";

const KEY = (process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api || "").trim();
// "Sarah" — mature, reassuring, confident; a premade voice available on the
// free tier. Override with ELEVENLABS_VOICE_ID (must be a voice on your account).
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";
const MODEL = process.env.ELEVENLABS_MODEL?.trim() || "eleven_turbo_v2_5";

/**
 * Companion voice via ElevenLabs. Returns audio/mpeg on success. On any failure
 * (no key, quota, error) returns 503 so the client falls back to browser speech.
 */
export async function POST(req: Request) {
  if (!KEY) {
    return NextResponse.json({ error: "no-tts-key" }, { status: 503 });
  }
  try {
    const { text } = await req.json();
    const line = String(text ?? "").trim();
    if (!line) return NextResponse.json({ error: "empty" }, { status: 400 });

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: line,
          model_id: MODEL,
          voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
        }),
      }
    );

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      console.warn("[/api/tts] ElevenLabs failed, client will fall back:", res.status, detail.slice(0, 160));
      return NextResponse.json({ error: "tts-failed" }, { status: 503 });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/tts]", err);
    return NextResponse.json({ error: "tts-error" }, { status: 503 });
  }
}
