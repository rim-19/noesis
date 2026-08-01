"use client";

import { motion } from "framer-motion";
import { CompanionWisp } from "./CompanionWisp";
import { GoalComposer } from "./GoalComposer";
import { AmbientFireflies } from "./AmbientFireflies";
import { GrowthStage } from "./GrowthStage";

/**
 * First run / empty garden — a real hero: what Noesis is, how it works, and one
 * input to begin. This is the entry point, not a bare canvas.
 */
export function EmptyState({
  busy,
  onSubmit,
  onSurprise,
}: {
  busy: boolean;
  onSubmit: (goal: string, opts?: { sourceUrl?: string; source?: { name: string; text: string } }) => void;
  onSurprise: () => void;
}) {
  return (
    <div className="dusk-field relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <AmbientFireflies opacity={0.45} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="mb-6"><CompanionWisp state="idle" size={72} label="Your tutor, waiting" /></div>

        <h1 className="spoken mb-3 text-3xl text-moonlight sm:text-4xl">
          Learn anything. Prove you understand it.
        </h1>
        <p className="mb-8 max-w-md text-[15px] leading-relaxed text-moonlight-dim">
          Noesis is a tutor that teaches you a subject — by chat or by voice — then grows a garden of everything
          you&apos;ve truly understood. Concepts bloom only when you can explain them back.
        </p>

        <GoalComposer variant="hero" busy={busy} onSubmit={onSubmit} />

        <div className="mt-4 flex items-center gap-3">
          <span className="data">not sure what to learn?</span>
          <button
            onClick={onSurprise}
            disabled={busy}
            className="rounded-full px-4 py-1.5 text-sm font-display transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: "rgba(245,205,118,0.14)", border: "1px solid rgba(245,205,118,0.4)", color: "var(--firefly-gold)" }}
          >
            🎲 Surprise me
          </button>
        </div>

        {/* how it works */}
        <div className="mt-12 grid w-full grid-cols-3 gap-3 text-center">
          <Step stage="seed" title="Pick a goal" body="Tell Noesis what you want to learn." />
          <Step stage="sprout" title="Learn it" body="The tutor explains and answers, by text or voice." />
          <Step stage="bloom" title="Prove it" body="Explain it back — and watch it bloom." />
        </div>
      </motion.div>
    </div>
  );
}

function Step({ stage, title, body }: { stage: "seed" | "sprout" | "bloom"; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl px-3 py-4" style={{ background: "color-mix(in srgb, var(--dusk-ink-2) 55%, transparent)", border: "1px solid var(--dusk-line)" }}>
      <GrowthStage status={stage} size={44} />
      <span className="font-display text-sm text-moonlight">{title}</span>
      <span className="text-xs leading-snug text-moonlight-dim">{body}</span>
    </div>
  );
}
