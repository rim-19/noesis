"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { GrowthStage } from "./GrowthStage";
import { useVoice } from "@/lib/useVoice";
import type { CheckpointResult, Garden, GraphNode } from "@/lib/types";

/**
 * Verification. After learning, the learner explains the concept in their own
 * words (typed or spoken). It's graded for real understanding — bloom or not.
 */
export function Checkpoint({
  node,
  onClose,
  onResult,
}: {
  node: GraphNode;
  onClose: () => void;
  onResult: (result: CheckpointResult, garden: Garden) => void;
}) {
  const { supported, listening, transcribing, listen } = useVoice();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckpointResult | null>(null);

  const talk = useCallback(async () => {
    if (busy || listening) return;
    const said = await listen();
    if (said.trim()) setText((t) => (t ? t + " " + said.trim() : said.trim()));
  }, [busy, listening, listen]);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          transcript: [
            { speaker: "ai", text: `Explain ${node.topic} in your own words.` },
            { speaker: "user", text: text.trim() },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setResult(data.result as CheckpointResult);
      onResult(data.result as CheckpointResult, data.garden as Garden);
    } catch {
      setError("Couldn't grade that — your progress is safe. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const bloomed = result?.next_status === "bloom";

  return (
    <motion.div
      className="dusk-field fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-lg">
        <div className="mb-5 flex items-center gap-3">
          <GrowthStage status={node.status} size={44} />
          <div>
            <div className="data">checkpoint</div>
            <h2 className="font-display text-lg text-moonlight">{node.topic}</h2>
          </div>
        </div>

        {!result ? (
          <>
            <p className="mb-3 text-sm text-moonlight-dim">
              Explain this in your own words — like you&apos;re teaching a friend. That&apos;s what proves you&apos;ve got it.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              rows={7}
              placeholder={listening ? "listening…" : transcribing ? "hearing you…" : "Start explaining…"}
              className="w-full resize-none rounded-2xl px-4 py-3 text-[15px] outline-none placeholder:text-moonlight-faint"
              style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", color: "var(--moonlight)" }}
            />
            {error && <p className="mt-2 text-sm text-firefly-gold">{error}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <button onClick={onClose} className="data hover:text-moonlight-dim transition-colors">not now</button>
              <div className="flex items-center gap-2">
                {supported && (
                  <button
                    onClick={talk}
                    disabled={busy}
                    className="grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-95"
                    style={{ background: listening ? "var(--firefly-gold)" : "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", color: listening ? "var(--dusk-ink)" : "var(--moonlight)" }}
                    aria-label="Speak your explanation"
                  >
                    <MicIcon />
                  </button>
                )}
                <button
                  onClick={submit}
                  disabled={busy || !text.trim()}
                  className="rounded-full px-5 py-2.5 font-display text-[15px] transition-opacity disabled:opacity-40"
                  style={{ background: "var(--moss)", color: "var(--moonlight)" }}
                >
                  {busy ? "checking…" : "check my understanding"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl p-5" style={{ background: "var(--dusk-ink-2)", border: `1px solid ${bloomed ? "var(--blush)" : "var(--dusk-line)"}` }}>
            <div className="mb-2 flex items-center gap-2 text-lg">
              <span>{bloomed ? "🌸" : "🌱"}</span>
              <span className="font-display text-moonlight">{bloomed ? "Bloomed" : "Almost there"}</span>
            </div>
            <p className="spoken text-[15px] text-moonlight-dim">{result.companion_note}</p>
            {result.gaps.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {result.gaps.map((g, i) => (
                  <li key={i} className="text-sm text-moonlight-dim">• {g}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!bloomed && (
                <button onClick={() => { setResult(null); }} className="rounded-full px-4 py-2 text-sm" style={{ border: "1px solid var(--dusk-line)", color: "var(--moonlight)" }}>
                  try again
                </button>
              )}
              <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-display" style={{ background: "var(--firefly-gold)", color: "var(--dusk-ink)" }}>
                done
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
