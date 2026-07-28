"use client";

import { motion, useReducedMotion } from "framer-motion";

export type WispState = "idle" | "listening" | "thinking" | "bloomed";

const GLOW: Record<WispState, { core: string; halo: string; pulse: number }> = {
  // calm gold idle
  idle: { core: "#f2c464", halo: "rgba(242,196,100,0.45)", pulse: 3.4 },
  // brighter pulse when listening
  listening: { core: "#ffd77a", halo: "rgba(255,215,122,0.65)", pulse: 1.1 },
  // a slower, dimmer breath while it thinks
  thinking: { core: "#e8c887", halo: "rgba(232,200,135,0.4)", pulse: 0.9 },
  // soft rose flicker right after a node blooms
  bloomed: { core: "#f6a5cb", halo: "rgba(231,143,179,0.6)", pulse: 0.7 },
};

/**
 * The companion wisp — a small soft-glowing orb. Continuous gentle float is
 * the app's ambient heartbeat; glow color + pulse speed reflect app state.
 */
export function CompanionWisp({
  state = "idle",
  size = 56,
  onClick,
  floating = true,
  label,
}: {
  state?: WispState;
  size?: number;
  onClick?: () => void;
  floating?: boolean;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const g = GLOW[state];

  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      onClick={onClick}
      aria-label={label ?? "Companion"}
      className="relative grid place-items-center rounded-full"
      style={{ width: size, height: size, background: "transparent", border: "none", cursor: onClick ? "pointer" : "default" }}
      animate={
        reduce || !floating
          ? undefined
          : { y: [0, -7, 0, 5, 0], x: [0, 3, 0, -3, 0] }
      }
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      whileHover={onClick ? { scale: 1.06 } : undefined}
      whileTap={onClick ? { scale: 0.94 } : undefined}
    >
      {/* outer halo */}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${g.halo} 0%, transparent 68%)`,
          filter: "blur(4px)",
        }}
        animate={reduce ? undefined : { scale: [1, 1.28, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: g.pulse, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* core orb */}
      <motion.span
        className="relative rounded-full"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: `radial-gradient(circle at 38% 34%, #fff 0%, ${g.core} 46%, ${g.core} 100%)`,
          boxShadow: `0 0 ${size * 0.28}px ${g.halo}, 0 0 ${size * 0.55}px ${g.halo}`,
        }}
        animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
        transition={{ duration: g.pulse * 0.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </Wrapper>
  );
}
