// AI provider with graceful fallback: Gemini first, OpenRouter when Gemini is
// unavailable (quota exceeded, rate-limited, or key missing). Both are called
// over plain REST so there is no SDK/native dependency to build on Windows.

import "server-only";

const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
// Accept either casing since the .env may use `openrouter_key`.
const OPENROUTER_KEY = (
  process.env.OPENROUTER_API_KEY || process.env.openrouter_key || ""
).trim();

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
// Capable free models on OpenRouter with strong general knowledge and clean
// (non-chain-of-thought) output so JSON parses reliably. The first is primary;
// OpenRouter's `models` routing auto-tries the rest if one is rate-limited.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";
const OPENROUTER_FALLBACKS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  /** Ask the model to return a single JSON object. */
  json?: boolean;
  temperature?: number;
  /** Upper bound on the response length; teaching needs room to be thorough. */
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  provider: "gemini" | "openrouter";
}

/** Errors that mean "this provider is exhausted, try the fallback". */
function isQuotaOrRateError(status: number): boolean {
  return status === 429 || status === 402 || status === 403 || status >= 500;
}

async function callGemini(opts: GenerateOptions): Promise<string> {
  if (!GEMINI_KEY) throw new ProviderUnavailable("gemini", "no key");

  const system = opts.messages.find((m) => m.role === "system");
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (isQuotaOrRateError(res.status)) {
      throw new ProviderUnavailable("gemini", `status ${res.status}: ${detail.slice(0, 200)}`);
    }
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "";
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text;
}

async function callOpenRouter(opts: GenerateOptions): Promise<string> {
  if (!OPENROUTER_KEY) throw new ProviderUnavailable("openrouter", "no key");

  // When JSON is requested, reinforce it in the last user turn since we don't
  // rely on response_format (not all free models support it).
  const messages = opts.json
    ? opts.messages.map((m, i) =>
        i === opts.messages.length - 1 && m.role === "user"
          ? { ...m, content: `${m.content}\n\nReturn ONLY a single valid JSON object. No prose, no code fences.` }
          : m
      )
    : opts.messages;

  // Build a de-duplicated model list: primary first, then fallbacks.
  const models = [OPENROUTER_MODEL, ...OPENROUTER_FALLBACKS].filter(
    (m, i, a) => a.indexOf(m) === i
  );

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": "https://noesis.local",
      "X-Title": "Noesis",
    },
    body: JSON.stringify({
      model: models[0],
      models, // OpenRouter auto-falls-back through this list on error/rate-limit
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      // Many free models are reasoning models — without this they spend their
      // whole budget "thinking" and return an empty/slow answer. Keep it minimal.
      reasoning: { effort: "low" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenRouter returned an empty response");
  return text;
}

class ProviderUnavailable extends Error {
  constructor(public provider: string, reason: string) {
    super(`${provider} unavailable: ${reason}`);
  }
}

/**
 * Generate text, trying Gemini first and falling back to OpenRouter when
 * Gemini is out of quota / unavailable. Throws only if both fail.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  // Try Gemini unless it has no key.
  if (GEMINI_KEY) {
    try {
      const text = await callGemini(opts);
      return { text, provider: "gemini" };
    } catch (err) {
      if (!(err instanceof ProviderUnavailable)) {
        console.warn("[ai] Gemini failed, falling back:", (err as Error).message);
      } else {
        console.info("[ai] Gemini unavailable, falling back to OpenRouter:", err.message);
      }
    }
  }

  // Free models occasionally return an empty body or transient error — retry a
  // couple of times before giving up.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await callOpenRouter(opts);
      return { text, provider: "openrouter" };
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] OpenRouter attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("generation failed");
}

/** Parse a JSON object out of a model response, tolerating code fences / stray prose. */
export function parseJsonObject<T>(raw: string): T {
  let s = raw.trim();
  // Strip ```json ... ``` fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Otherwise slice from the first { to the last }.
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last !== -1) s = s.slice(first, last + 1);
  }
  return JSON.parse(s) as T;
}
