"use client";

import { motion } from "framer-motion";
import { CompanionWisp } from "./CompanionWisp";
import { GoalComposer } from "./GoalComposer";
import { AmbientFireflies } from "./AmbientFireflies";

/**
 * First launch: a dark, empty garden. One glowing input, a few example seeds,
 * and the companion already idle-floating nearby, waiting. This blank moment
 * happens exactly once.
 */
export function EmptyState({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (goal: string, opts?: { sourceUrl?: string; source?: { name: string; text: string } }) => void;
}) {
  return (
    <div className="dusk-field relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <AmbientFireflies opacity={0.5} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex w-full max-w-xl flex-col items-center text-center"
      >
        <div className="mb-6">
          <CompanionWisp state="idle" size={72} label="Your companion, waiting" />
        </div>

        <h1 className="spoken mb-2 text-2xl text-moonlight sm:text-3xl">
          Your garden is empty — for now.
        </h1>
        <p className="mb-9 max-w-sm text-sm text-moonlight-dim">
          Tell me one thing you want to learn. I&apos;ll plant it as the first seed and grow the path
          from there.
        </p>

        <GoalComposer variant="hero" busy={busy} onSubmit={onSubmit} />
      </motion.div>
    </div>
  );
}
