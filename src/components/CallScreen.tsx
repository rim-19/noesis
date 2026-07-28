"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CompanionWisp, type WispState } from "./CompanionWisp";
import { useVoice } from "@/lib/useVoice";
import type { CheckpointResult, EngagementMode, GraphNode, Garden, Turn } from "@/lib/types";

type Phase = "connecting" | "speaking" | "listening" | "yourturn" | "thinking" | "grading";

export function CallScreen({
  node,
  mode,
  onClose,
  onResult,
}: {
  node: GraphNode;
  mode: EngagementMode; // "call" | "listen"
  onClose: () => void;
  onResult: (result: CheckpointResult, garden: Garden) => void;
}) {
  const reduce = useReducedMotion();
  const { supported, listening, speaking, transcribing, level, listen, stopListening, speak, shutUp } = useVoice();
  const [phase, setPhase] = useState<Phase>("connecting");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const endedRef = useRef(false);
  const transcriptRef = useRef<Turn[]>([]);
  const push = useCallback((t: Turn) => {
    transcriptRef.current = [...transcriptRef.current, t];
    setTranscript(transcriptRef.current);
  }, []);

  const fetchReply = useCallback(
    async (history: Turn[]): Promise<string> => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, mode, history }),
      });
      if (!res.ok) throw new Error("chat failed");
      const data = await res.json();
      return String(data.text ?? "");
    },
    [node.id, mode]
  );

  // Drive the back-and-forth iteratively (no recursion): listen → reply → speak,
  // looping until the learner falls silent (then we wait for a mic tap) or hangs up.
  const converse = useCallback(async () => {
    while (!endedRef.current) {
      setPhase("listening");
      const said = await listen();
      if (endedRef.current) return;
      if (!said.trim()) {
        setPhase("yourturn"); // wait for the learner to tap the mic
        return;
      }
      push({ speaker: "user", text: said.trim() });
      setPhase("thinking");
      let reply: string;
      try {
        reply = await fetchReply(transcriptRef.current);
      } catch {
        setError("The companion lost the thread. Tap the mic to keep going, or close the call.");
        setPhase("yourturn");
        return;
      }
      if (endedRef.current) return;
      push({ speaker: "ai", text: reply });
      setPhase("speaking");
      await speak(reply);
    }
  }, [listen, push, fetchReply, speak]);

  // Kick off the conversation on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPhase("connecting");
        const opening = await fetchReply([]);
        if (cancelled || endedRef.current) return;
        push({ speaker: "ai", text: opening });
        setPhase("speaking");
        await speak(opening);
        if (cancelled || endedRef.current) return;
        await converse();
      } catch {
        if (!cancelled) {
          setError("Couldn't reach the companion. Check your connection and try again.");
          setPhase("yourturn");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hangUp = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    shutUp();
    const said = transcriptRef.current;
    const userSpoke = said.some((t) => t.speaker === "user" && t.text.trim());
    if (!userSpoke) {
      onClose();
      return;
    }
    setPhase("grading");
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, mode, transcript: said }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "grade failed");
      onResult(data.result as CheckpointResult, data.garden as Garden);
    } catch {
      setError("Couldn't tell how that went — your garden is safe. Closing the call.");
      setTimeout(onClose, 1600);
    }
  }, [node.id, mode, shutUp, onClose, onResult]);

  const wispState: WispState =
    phase === "listening" ? "listening" : phase === "thinking" || phase === "grading" || phase === "connecting" ? "thinking" : "idle";

  const statusText =
    phase === "connecting"
      ? "waking…"
      : phase === "grading"
        ? "seeing how that grew…"
        : transcribing
          ? "hearing you…"
          : speaking
            ? "speaking"
            : phase === "listening"
              ? "listening"
              : phase === "thinking"
                ? "thinking"
                : "your turn";

  return (
    <motion.div
      className="dusk-field fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* node being discussed */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
        <div className="data">talking through</div>
        <div className="spoken text-base text-moonlight">{node.topic}</div>
      </div>

      {!supported && (
        <p className="absolute top-20 max-w-xs text-center text-sm text-moonlight-dim">
          I can&apos;t reach your microphone. Allow mic access and try again, or close this and choose
          &ldquo;Write it out&rdquo; instead.
        </p>
      )}

      {/* the wisp, focal, with a waveform ripple while sound flows */}
      <div className="relative grid place-items-center" style={{ width: 240, height: 240 }}>
        <Waveform active={(speaking || listening) && !reduce} state={wispState} level={level} />
        <CompanionWisp state={wispState} size={110} floating />
      </div>

      <div className="mt-4 data" style={{ letterSpacing: "0.12em" }}>
        {statusText}
      </div>

      {/* captions — the last thing said */}
      <div className="mt-6 h-24 w-full max-w-md overflow-hidden px-2 text-center">
        {captionsOn && (
          <AnimatePresence mode="popLayout">
            <motion.p
              key={transcript.length}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="spoken text-[15px] text-moonlight-dim"
            >
              {transcript.length ? transcript[transcript.length - 1].text : ""}
            </motion.p>
          </AnimatePresence>
        )}
      </div>

      {error && <p className="mt-2 max-w-sm text-center text-sm text-firefly-gold">{error}</p>}

      {/* controls */}
      <div className="absolute bottom-8 flex flex-wrap items-center justify-center gap-4 px-4 sm:bottom-10 sm:gap-6">
        <button
          onClick={() => setCaptionsOn((v) => !v)}
          className="data rounded-full px-3 py-2 transition-colors hover:text-moonlight"
          style={{ border: "1px solid rgba(232,236,241,0.10)" }}
        >
          {captionsOn ? "captions on" : "captions off"}
        </button>

        {/* while listening: let them end the turn early instead of waiting for silence */}
        {listening && (
          <button
            onClick={stopListening}
            className="grid h-14 w-14 place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: "var(--sprout)", color: "var(--dusk-ink)" }}
            aria-label="Done talking"
          >
            <DoneIcon />
          </button>
        )}

        {/* tap-to-talk when it's the learner's turn */}
        {!listening && (phase === "yourturn" || phase === "listening") && supported && (
          <button
            onClick={converse}
            className="grid h-14 w-14 place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: "var(--sprout)", color: "var(--dusk-ink)" }}
            aria-label="Tap to talk"
          >
            <MicIcon />
          </button>
        )}

        {/* hang up — a closing bud */}
        <button
          onClick={hangUp}
          disabled={phase === "grading"}
          className="grid h-14 w-14 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: "rgba(232,236,241,0.06)", border: "1px solid rgba(232,236,241,0.14)" }}
          aria-label="End the call"
        >
          <ClosingBud />
        </button>
      </div>
    </motion.div>
  );
}

function Waveform({
  active,
  state,
  level = 0,
}: {
  active: boolean;
  state: WispState;
  level?: number;
}) {
  const rings = [0, 1, 2];
  const color = state === "listening" ? "rgba(255,215,122,0.4)" : "rgba(242,196,100,0.28)";
  // Ripples swell with how loudly the learner is actually speaking.
  const reach = 1.8 + Math.min(level * 6, 1.1);
  return (
    <>
      {rings.map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: 120, height: 120, border: `1px solid ${color}` }}
          animate={active ? { scale: [1, reach], opacity: [0.5, 0] } : { scale: 1, opacity: 0 }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClosingBud() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 21c-4-2-6-5-6-9 0 0 3 1 6 1s6-1 6-1c0 4-2 7-6 9Z" fill="var(--moonlight-dim)" opacity={0.8} />
      <path d="M12 12V3" stroke="var(--moonlight-dim)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
