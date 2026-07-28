"use client";

import { type EdgeProps, BaseEdge } from "@xyflow/react";

/**
 * Organic growth-line: a soft curved path that looks grown, not computed.
 * Instead of a right-angled or symmetric bezier, we bow the curve with a
 * gentle sag and offset control points so it reads like a vine between plants.
 */
export function GrowthEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const midX = sourceX + dx * 0.5;
  const midY = sourceY + dy * 0.5;

  // Bow the vine: perpendicular offset + a little downward sag (gravity).
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(60, len * 0.22);
  const c1x = sourceX + dx * 0.33 + nx * bow;
  const c1y = sourceY + dy * 0.33 + ny * bow + 14;
  const c2x = sourceX + dx * 0.66 + nx * bow * 0.5;
  const c2y = sourceY + dy * 0.66 + ny * bow * 0.5 + 22;

  const path = `M ${sourceX},${sourceY} C ${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`;
  const grown = (data as { grown?: boolean } | undefined)?.grown;

  return (
    <>
      {/* faint glow underlay */}
      <path
        d={path}
        fill="none"
        stroke={grown ? "var(--moss)" : "var(--seed-gray)"}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.12}
      />
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: grown ? "var(--sprout)" : "var(--seed-gray)",
          strokeWidth: 1.6,
          strokeLinecap: "round",
          strokeDasharray: grown ? "none" : "1 7",
          opacity: grown ? 0.75 : 0.5,
        }}
      />
      {/* a small node where the vine meets its child, like a bud */}
      <circle cx={midX} cy={midY} r={2} fill={grown ? "var(--sprout)" : "var(--seed-gray)"} opacity={0.6} />
    </>
  );
}
