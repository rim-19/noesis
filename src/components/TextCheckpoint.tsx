"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GrowthStage } from "./GrowthStage";
import type { CheckpointResult, Garden, GraphNode, Turn } from "@/lib/types";

/**
 * "Write it out" — the quiet, no-voice checkpoint. Same grading path as a call,
 * just a typed explanation instead of a spoken one.
 */
export function TextCheckpoint({
  node,
  onClose,
  onResult,
}: {
  node: GraphNode;
  onClose: () => void;
  onResult: (result: CheckpointResult, garden: Garden) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const transcript: Turn[] = [
      { speaker: "ai", text: `Explain ${node.topic} in your own words.` },
      { speaker: "user", text: text.trim() },
    ];
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, mode: "text", transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "grade failed");
      onResult(data.result as CheckpointResult, data.garden as Garden);
    } catch {
      setError("Couldn't read that just now — your garden is safe. Try again.");
      setBusy(false);
    }
  };

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
            <div className="data">write it out</div>
            <h2 className="spoken text-lg text-moonlight">{node.topic}</h2>
          </div>
        </div>

        <p className="mb-3 text-sm text-moonlight-dim">
          In your own words — not the source&apos;s — explain this like you&apos;re telling a friend. That&apos;s
          what turns it green.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          rows={7}
          placeholder="Start explaining…"
          className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-moonlight-faint"
          style={{ border: "1px solid rgba(232,236,241,0.12)", color: "var(--moonlight)" }}
        />

        {error && <p className="mt-2 text-sm text-firefly-gold">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <button onClick={onClose} className="data hover:text-moonlight-dim transition-colors">
            not now
          </button>
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-full px-5 py-2.5 font-display text-[15px] transition-opacity disabled:opacity-40"
            style={{ background: "var(--moss)", color: "var(--moonlight)" }}
          >
            {busy ? "reading…" : "see how it grew"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
