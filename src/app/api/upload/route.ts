import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_CHARS = 8000; // enough to shape a graph; keeps prompts sane

/**
 * Bring-your-own-source (file). Accepts a PDF (or plain text) upload, extracts
 * its text, and returns it so the client can hand it to graph generation as the
 * spine of the roadmap.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a file first." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That file's a bit big — keep it under 15 MB." }, { status: 413 });
    }

    const name = file.name || "your file";
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);

    let text = "";
    if (isPdf) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const extracted = await extractText(pdf, { mergePages: true });
      text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
    } else {
      text = await file.text();
    }

    text = text.replace(/\s+\n/g, "\n").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read any text from that — is it a scanned image?" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      name,
      text: text.slice(0, MAX_CHARS),
      truncated: text.length > MAX_CHARS,
    });
  } catch (err) {
    console.error("[/api/upload]", err);
    return NextResponse.json({ error: "Couldn't open that file. Try a PDF or a text file." }, { status: 500 });
  }
}
