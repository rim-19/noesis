"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EXAMPLES = ["Learn Morse code", "Understand WebGPU compute shaders", "How neural nets learn"];

type SubmitOpts = { sourceUrl?: string; source?: { name: string; text: string } };

export function GoalComposer({
  variant,
  busy,
  onSubmit,
}: {
  variant: "hero" | "compact";
  busy: boolean;
  onSubmit: (goal: string, opts?: SubmitOpts) => void;
}) {
  const [goal, setGoal] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [source, setSource] = useState("");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const submit = () => {
    if (!goal.trim() || busy) return;
    onSubmit(goal.trim(), { sourceUrl: source.trim() || undefined, source: file ?? undefined });
    setGoal("");
    setSource("");
    setFile(null);
    setSourceOpen(false);
  };

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that file.");
      setFile({ name: data.name, text: data.text });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const hero = variant === "hero";

  return (
    <div className={hero ? "w-full max-w-xl" : "w-full max-w-md"}>
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-shadow sm:px-4 sm:py-3"
        style={{
          background: "color-mix(in srgb, var(--dusk-ink-2) 88%, transparent)",
          border: "1px solid rgba(232,236,241,0.10)",
          boxShadow: hero
            ? "0 0 60px rgba(242,196,100,0.10), inset 0 1px 0 rgba(232,236,241,0.04)"
            : "0 8px 30px rgba(0,0,0,0.35)",
        }}
      >
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="What do you want to learn?"
          autoFocus={hero}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-moonlight-faint ${
            hero ? "font-display text-base sm:text-lg" : "text-[15px]"
          }`}
          style={{ color: "var(--moonlight)" }}
        />
        <button
          onClick={submit}
          disabled={busy || !goal.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-30"
          style={{ background: "var(--firefly-gold)", color: "var(--dusk-ink)" }}
          aria-label="Plant this goal"
        >
          {busy ? <Spinner /> : <ArrowIcon />}
        </button>
      </div>

      {/* bring your own source */}
      <div className="mt-2 px-1">
        <button
          onClick={() => setSourceOpen((v) => !v)}
          className="data hover:text-moonlight-dim transition-colors"
        >
          {sourceOpen ? "— hide my own source" : "+ learn from my own source"}
        </button>
        <AnimatePresence>
          {sourceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Paste a video, article, or doc link…"
                className="mt-2 w-full rounded-xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-moonlight-faint"
                style={{ border: "1px solid rgba(232,236,241,0.10)", color: "var(--moonlight)" }}
              />

              {/* file upload */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf,.txt,.md"
                  hidden
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="data rounded-lg px-2.5 py-1.5 transition-colors hover:text-moonlight disabled:opacity-50"
                  style={{ border: "1px solid rgba(232,236,241,0.10)" }}
                >
                  {uploading ? "reading…" : file ? "change file" : "or upload a PDF / doc"}
                </button>
                {file && (
                  <span className="data flex items-center gap-1.5" style={{ color: "var(--sprout)" }}>
                    🌿 {file.name}
                    <button onClick={() => setFile(null)} aria-label="Remove file" className="hover:text-moonlight">
                      ✕
                    </button>
                  </span>
                )}
              </div>
              {uploadError && <p className="mt-1.5 text-xs text-firefly-gold">{uploadError}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hero && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => !busy && onSubmit(ex)}
              disabled={busy}
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-40"
              style={{
                border: "1px solid rgba(232,236,241,0.10)",
                color: "var(--moonlight-dim)",
              }}
            >
              <SeedDot />
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SeedDot() {
  return <span className="inline-block h-2 w-2 rounded-full opacity-70" style={{ background: "var(--sprout)" }} />;
}
function Spinner() {
  return (
    <motion.span
      className="block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
    />
  );
}
