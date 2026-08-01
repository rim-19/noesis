"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CompanionWisp } from "./CompanionWisp";
import { useVoice } from "@/lib/useVoice";
import type { GraphNode, Message } from "@/lib/types";

/**
 * The teaching experience: a persistent chat with the tutor about one concept.
 * You can type or talk (mic), and optionally have replies read aloud. This is
 * where learning actually happens — verification is a separate step.
 */
export function LessonChat({
  node,
  subjectTitle,
  onClose,
  onStarted,
}: {
  node: GraphNode;
  subjectTitle: string;
  onClose: () => void;
  onStarted: () => void; // node moved to "sprout"
}) {
  const { supported, listening, transcribing, speak, listen, shutUp } = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const send = useCallback(
    async (content: string, voice: boolean) => {
      if (thinking) return;
      setError(null);
      // optimistic user bubble
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
        setMessages((m) => [...m, data.message as Message]);
        if (!startedRef.current) {
          startedRef.current = true;
          onStarted();
        }
        scrollDown();
        if (voice || readAloud) speak((data.message as Message).content);
      } catch {
        setError("The tutor lost the thread for a second. Try again.");
      } finally {
        setThinking(false);
      }
    },
    [node.id, thinking, readAloud, speak, scrollDown, onStarted]
  );

  // Load existing thread; if empty, open the lesson (tutor teaches first).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lesson?nodeId=${encodeURIComponent(node.id)}`);
        const data = await res.json();
        if (cancelled) return;
        const existing = (data.messages ?? []) as Message[];
        setMessages(existing);
        if (existing.length === 0) {
          send("", false); // tutor opens with a first lesson
        } else {
          startedRef.current = true;
          scrollDown();
        }
      } catch {
        if (!cancelled) setError("Couldn't open the lesson. Check your connection.");
      }
    })();
    return () => {
      cancelled = true;
      shutUp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const talk = useCallback(async () => {
    if (thinking || listening) return;
    const said = await listen();
    if (said.trim()) send(said, true); // voice input → spoken, conversational reply
  }, [thinking, listening, listen, send]);

  const submitTyped = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    send(t, readAloud);
  };

  return (
    <motion.div
      className="dusk-field fixed inset-0 z-[60] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6" style={{ borderColor: "var(--dusk-line)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <CompanionWisp state={thinking ? "thinking" : "idle"} size={40} floating={false} />
          <div className="min-w-0">
            <div className="data truncate">{subjectTitle} · learning</div>
            <h2 className="font-display text-lg text-moonlight truncate">{node.topic}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setReadAloud((v) => !v);
              if (readAloud) shutUp();
            }}
            className="rounded-full px-3 py-1.5 text-xs transition-colors"
            style={{
              border: "1px solid var(--dusk-line)",
              background: readAloud ? "rgba(245,205,118,0.15)" : "transparent",
              color: readAloud ? "var(--firefly-gold)" : "var(--moonlight-dim)",
            }}
          >
            {readAloud ? "🔊 reading aloud" : "🔈 read aloud"}
          </button>
          <button
            onClick={onClose}
            aria-label="Close lesson"
            className="grid h-9 w-9 place-items-center rounded-full text-moonlight-dim transition-colors hover:text-moonlight"
            style={{ border: "1px solid var(--dusk-line)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m) =>
            m.role === "tutor" ? (
              <div key={m.id} className="max-w-[92%] self-start rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)" }}>
                <div className="tutor-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-tr-sm px-4 py-2.5 text-[15px]" style={{ background: "var(--moss)", color: "var(--moonlight)" }}>
                {m.content}
              </div>
            )
          )}
          {thinking && (
            <div className="self-start rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)" }}>
              <TypingDots />
            </div>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitTyped();
              }
            }}
            rows={1}
            placeholder={listening ? "listening…" : transcribing ? "hearing you…" : "Ask anything, or explain it back…"}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl px-4 py-2.5 text-[15px] outline-none placeholder:text-moonlight-faint"
            style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", color: "var(--moonlight)" }}
          />
          {supported && (
            <button
              onClick={talk}
              disabled={thinking}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
              style={{ background: listening ? "var(--firefly-gold)" : "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", color: listening ? "var(--dusk-ink)" : "var(--moonlight)" }}
              aria-label="Talk to the tutor"
            >
              <MicIcon />
            </button>
          )}
          <button
            onClick={submitTyped}
            disabled={thinking || !input.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-30"
            style={{ background: "var(--firefly-gold)", color: "var(--dusk-ink)" }}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-2 w-2 rounded-full" style={{ background: "var(--moonlight-faint)" }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
      ))}
    </div>
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
