"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * A gentle in-app refresher nudge, in the garden's own voice. Appears when a
 * bloomed node has started to wilt. Works with or without push notifications.
 */
export function NudgeBanner({
  wilting,
  onRefresh,
  onDismiss,
}: {
  wilting: { id: string; topic: string }[];
  onRefresh: (id: string) => void;
  onDismiss: () => void;
}) {
  const first = wilting[0];
  return (
    <AnimatePresence>
      {first && (
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          className="pointer-events-auto flex max-w-[92vw] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl px-4 py-2.5"
          style={{
            background: "color-mix(in srgb, var(--dusk-ink-3) 88%, transparent)",
            border: "1px solid rgba(242,196,100,0.30)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span className="text-base">🍂</span>
          <span className="spoken text-sm text-moonlight">
            {wilting.length === 1 ? (
              <>&ldquo;{first.topic}&rdquo; is wilting a little.</>
            ) : (
              <>{wilting.length} nodes are wilting — start with &ldquo;{first.topic}&rdquo;.</>
            )}
          </span>
          <button
            onClick={() => onRefresh(first.id)}
            className="ml-1 rounded-full px-3 py-1 text-xs font-display transition-colors"
            style={{ background: "var(--firefly-gold)", color: "var(--dusk-ink)" }}
          >
            quick refresher
          </button>
          <button onClick={onDismiss} aria-label="Dismiss" className="data hover:text-moonlight">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
