"use client";

import { motion, useReducedMotion } from "framer-motion";

const FIREFLIES = [
  { x: 12, y: 20, s: 3, d: 5, delay: 0 },
  { x: 82, y: 28, s: 2, d: 6.5, delay: 1.2 },
  { x: 24, y: 74, s: 2.5, d: 5.5, delay: 0.6 },
  { x: 70, y: 66, s: 3, d: 7, delay: 2 },
  { x: 46, y: 14, s: 2, d: 6, delay: 1.6 },
  { x: 90, y: 80, s: 2.5, d: 5.2, delay: 0.3 },
  { x: 8, y: 52, s: 2, d: 6.8, delay: 2.4 },
  { x: 58, y: 88, s: 2, d: 6.2, delay: 1.0 },
  { x: 36, y: 40, s: 1.6, d: 7.4, delay: 3.0 },
];

/** Faint far-off fireflies for depth — the garden's ambient heartbeat. */
export function AmbientFireflies({ opacity = 0.5 }: { opacity?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {FIREFLIES.map((f, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: f.s,
            height: f.s,
            background: "var(--firefly-gold)",
            filter: "blur(1px)",
          }}
          animate={reduce ? { opacity: 0.15 } : { opacity: [0.05, opacity, 0.05], y: [0, -6, 0] }}
          transition={{ duration: f.d, repeat: Infinity, delay: f.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
