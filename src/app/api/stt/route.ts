import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ELEVEN_KEY = (process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api || "").trim();
const ELEVEN_STT_MODEL = process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v1";
// Optional fallback if you add a Groq key later.
const GROQ_KEY = (process.env.GROQ_API_KEY || process.env.groq_key || "").trim();
const GROQ_MODEL = process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo";

/**
 * Speech-to-text. Replaces the browser's Web Speech API so voice works in every
 * browser (Safari, Firefox, mobile), not just Chrome.
 * ElevenLabs Scribe primary; Groq Whisper as an optional fallback.
 */
export async function POST(req: Request) {
  let audio: File;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (!(f instanceof File) || f.size === 0) {
      return NextResponse.json({ error: "no-audio" }, { status: 400 });
    }
    audio = f;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // Very short clips are almost certainly silence/noise — skip the API call.
  if (audio.size < 2000) {
    return NextResponse.json({ text: "", provider: "skipped" });
  }

  if (ELEVEN_KEY) {
    try {
      const fd = new FormData();
      fd.append("file", audio, audio.name || "speech.webm");
      fd.append("model_id", ELEVEN_STT_MODEL);
      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": ELEVEN_KEY },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ text: String(data.text ?? "").trim(), provider: "elevenlabs" });
      }
      const detail = await res.text().catch(() => "");
      console.warn("[/api/stt] ElevenLabs failed:", res.status, detail.slice(0, 160));
    } catch (err) {
      console.warn("[/api/stt] ElevenLabs error:", (err as Error).message);
    }
  }

  if (GROQ_KEY) {
    try {
      const fd = new FormData();
      fd.append("file", audio, audio.name || "speech.webm");
      fd.append("model", GROQ_MODEL);
      fd.append("response_format", "json");
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ text: String(data.text ?? "").trim(), provider: "groq" });
      }
      console.warn("[/api/stt] Groq failed:", res.status);
    } catch (err) {
      console.warn("[/api/stt] Groq error:", (err as Error).message);
    }
  }

  return NextResponse.json({ error: "stt-unavailable" }, { status: 503 });
}
