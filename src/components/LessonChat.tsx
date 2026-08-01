"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CompanionWisp } from "./CompanionWisp";
import { useVoice } from "@/lib/useVoice";
import type { GraphNode, Message } from "@/lib/types";

/** Strip markdown so speech doesn't read out "#", "**", backticks, etc. */
function toSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " (code example) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function LessonChat({
  node,
  subjectTitle,
  onClose,
  onStarted,
}: {
  node: GraphNode;
  subjectTitle: string;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { supported, listening, transcribing, speak, listen, shutUp } = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }, []);

  const speakMessage = useCallback(
    (m: Message) => {
      shutUp();
      setSpeakingId(m.id);
      speak(toSpeech(m.content)).then(() => setSpeakingId((p) => (p === m.id ? null : p)));
    },
    [speak, shutUp]
  );

  const toggleSpeak = useCallback(
    (m: Message) => {
      if (speakingId === m.id) { shutUp(); setSpeakingId(null); }
      else speakMessage(m);
    },
    [speakingId, speakMessage, shutUp]
  );

  const send = useCallback(
    async (content: string, voice: boolean) => {
      if (thinking) return;
      setError(null);
      if (content.trim()) {
        setMessages((m) => [...m, { id: `local_${m.length}`, role: "user", content: content.trim(), created_at: Date.now() }]);
        scrollDown();
      }
      setThinking(true);
      try {
        const res = await fetch("/api/lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: node.id, content, voice }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "failed");
        const msg = data.message as Message;
        setMessages((m) => [...m, msg]);
        if (!startedRef.current) { startedRef.current = true; onStarted(); }
        scrollDown();
        if (voice) speakMessage(msg); // spoken conversation reads the reply back
      } catch {
        setError("The tutor lost the thread for a second. Try again.");
      } finally {
        setThinking(false);
      }
    },
    [node.id, thinking, speakMessage, scrollDown, onStarted]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lesson?nodeId=${encodeURIComponent(node.id)}`);
        const data = await res.json();
        if (cancelled) return;
        const existing = (data.messages ?? []) as Message[];
        setMessages(existing);
        if (existing.length === 0) send("", false);
        else { startedRef.current = true; scrollDown(); }
      } catch {
        if (!cancelled) setError("Couldn't open the lesson. Check your connection.");
      }
    })();
    return () => { cancelled = true; shutUp(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // Escape closes the lesson.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const talk = useCallback(async () => {
    if (thinking || listening) return;
    const said = await listen();
    if (said.trim()) send(said, true);
  }, [thinking, listening, listen, send]);

  const submitTyped = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    send(t, false);
  };

  return (
    <motion.div className="dusk-field fixed inset-0 z-[60] flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* header with a clear exit */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6" style={{ borderColor: "var(--dusk-line)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-moonlight-dim transition-colors hover:text-moonlight" style={{ border: "1px solid var(--dusk-line)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to garden
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0 text-right">
            <div className="data truncate">{subjectTitle} · learning</div>
            <h2 className="font-display text-base text-moonlight truncate sm:text-lg">{node.topic}</h2>
          </div>
          <CompanionWisp state={thinking ? "thinking" : "idle"} size={38} floating={false} />
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m) =>
            m.role === "tutor" ? (
              <div key={m.id} className="group flex max-w-[94%] items-start gap-2 self-start">
                <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)" }}>
                  <div className="tutor-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                </div>
                <button
                  onClick={() => toggleSpeak(m)}
                  aria-label={speakingId === m.id ? "Stop reading" : "Read this aloud"}
                  title={speakingId === m.id ? "Stop" : "Read aloud"}
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors"
                  style={{
                    border: "1px solid var(--dusk-line)",
                    background: speakingId === m.id ? "rgba(245,205,118,0.18)" : "transparent",
                    color: speakingId === m.id ? "var(--firefly-gold)" : "var(--moonlight-faint)",
                  }}
                >
                  {speakingId === m.id ? <StopIcon /> : <SpeakerIcon />}
                </button>
              </div>
            ) : (
              <div key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-tr-sm px-4 py-2.5 text-[15px]" style={{ background: "var(--moss)", color: "var(--moonlight)" }}>
                {m.content}
              </div>
            )
          )}
          {thinking && (
            <div className="self-start rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)" }}><TypingDots /></div>
          )}
          {error && <p className="self-center text-sm text-firefly-gold">{error}</p>}
        </div>
      </div>

      {/* input */}
      <div className="border-t px-4 py-3 sm:px-6" style={{ borderColor: "var(--dusk-line)" }}>
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitTyped(); } }}
            rows={1}
            placeholder={listening ? "listening…" : transcribing ? "hearing you…" : "Ask anything, or explain it back…"}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl px-4 py-2.5 text-[15px] outline-none placeholder:text-moonlight-faint"
            style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", color: "var(--moonlight)" }}
          />
          {supported && (
            <button onClick={talk} disabled={thinking} className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40" style={{ background: listening ? "var(--firefly-gold)" : "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", color: listening ? "var(--dusk-ink)" : "var(--moonlight)" }} aria-label="Talk to the tutor">
              <MicIcon />
            </button>
          )}
          <button onClick={submitTyped} disabled={thinking || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-30" style={{ background: "var(--firefly-gold)", color: "var(--dusk-ink)" }} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return <div className="flex gap-1.5">{[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full" style={{ background: "var(--moonlight-faint)" }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />)}</div>;
}
function MicIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function SpeakerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" /><path d="M16 8.5a4 4 0 0 1 0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function StopIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" /></svg>;
}
