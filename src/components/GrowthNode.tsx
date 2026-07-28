"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, useReducedMotion } from "framer-motion";
import { GrowthStage } from "./GrowthStage";
import type { NodeStatus } from "@/lib/types";

export interface GrowthNodeData {
  topic: string;
  status: NodeStatus;
  justBloomed?: boolean;
  [key: string]: unknown;
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  seed: "still a seed",
  sprout: "sprouting",
  bloom: "bloomed",
};

function GrowthNodeInner({ data, selected }: NodeProps) {
  const reduce = useReducedMotion();
  const d = data as GrowthNodeData;
  const status = d.status;

  return (
    <motion.div
      className="relative flex w-[132px] flex-col items-center text-center select-none"
      // Seeds have a barely-perceptible breathing pulse: "waiting for you".
      animate={
        reduce || status !== "seed"
          ? { scale: 1 }
          : { scale: [1, 1.035, 1], opacity: [0.86, 1, 0.86] }
      }
      transition={{ duration: 4.5, repeat: status === "seed" ? Infinity : 0, ease: "easeInOut" }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      {/* soft pool of light under a selected / bloomed node */}
      <div
        className="pointer-events-none absolute -top-1 h-16 w-16 rounded-full transition-opacity duration-500"
        style={{
          background:
            status === "bloom"
              ? "radial-gradient(circle, rgba(231,143,179,0.38) 0%, transparent 70%)"
              : selected
                ? "radial-gradient(circle, rgba(242,196,100,0.22) 0%, transparent 70%)"
                : "transparent",
          filter: "blur(3px)",
        }}
      />

      <div
        className="rounded-full p-1 transition-transform duration-300"
        style={{
          transform: selected ? "scale(1.12)" : "scale(1)",
        }}
      >
        {d.justBloomed && !reduce ? <BloomBurst /> : null}
        <GrowthStage status={status} size={60} />
      </div>

      <div
        className="mt-1 max-w-[132px] font-display text-[13px] leading-tight"
        style={{
          color: status === "seed" ? "var(--moonlight-dim)" : "var(--moonlight)",
        }}
      >
        {d.topic}
      </div>
      <div className="data mt-0.5">{STATUS_LABEL[status]}</div>
    </motion.div>
  );
}

/** The orchestrated bloom moment: a short soft particle-bud burst (<600ms). */
function BloomBurst() {
  const buds = Array.from({ length: 8 });
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      {buds.map((_, i) => {
        const angle = (i / buds.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: ["var(--blush)", "var(--firefly-gold)", "var(--wisteria)", "var(--petal)"][i % 4] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * 34,
              y: Math.sin(angle) * 34,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

export const GrowthNode = memo(GrowthNodeInner);
