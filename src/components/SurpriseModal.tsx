"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Small explainer window for "Surprise me" — describes what it does, then a
 * button that actually asks the AI to pick a random subject and build its course.
 */
export function SurpriseModal({
  open,
  busy,
  onPick,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  onPick: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70]"
            style={{ background: "rgba(15,10,20,0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && onClose()}
          />
          <div className="fixed inset-0 z-[71] grid place-items-center p-6">
            <motion.div
              className="w-full max-w-sm rounded-2xl p-6 text-center"
              style={{ background: "var(--dusk-ink-2)", border: "1px solid var(--dusk-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <div className="mb-3 text-4xl">🎲</div>
              <h2 className="spoken mb-2 text-xl text-moonlight">Surprise me</h2>
              <p className="mb-6 text-sm leading-relaxed text-moonlight-dim">
                Not sure what to learn? I&apos;ll pick a genuinely interesting subject from <em>any</em> field —
                science, art, history, a niche craft, a strange phenomenon — and grow you a full course to
                learn it from scratch.
              </p>

              <button
                onClick={onPick}
                disabled={busy}
                className="w-full rounded-full py-3 font-display text-[15px] transition-transform active:scale-[0.98] disabled:opacity-70"
                style={{ background: "var(--firefly-gold)", color: "var(--dusk-ink)" }}
              >
                {busy ? "finding something fascinating…" : "Pick a random subject"}
              </button>
              {!busy && (
                <button onClick={onClose} className="mt-3 data hover:text-moonlight-dim transition-colors">
                  never mind
                </button>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
