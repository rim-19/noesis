"use client";

import type { NodeStatus } from "@/lib/types";

/**
 * Hand-drawn-feeling growth-stage illustrations. One metaphor, three stages:
 *   seed   — a dormant seed resting in soil (gray, waiting)
 *   sprout — a young stem with two leaves (pale green, in progress)
 *   bloom  — an open flower (moss green + firefly-gold heart, proven)
 *
 * Rendered as inline SVG so it scales from tiny graph nodes to the large
 * panel header illustration without loss.
 */
export function GrowthStage({
  status,
  size = 64,
  className = "",
}: {
  status: NodeStatus;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* soil mound — shared ground line */}
      <path
        d="M12 47 Q32 41 52 47 Q52 52 32 52 Q12 52 12 47 Z"
        fill="currentColor"
        className="text-seed-gray"
        opacity={0.35}
      />

      {status === "seed" && (
        <g className="text-seed-gray">
          {/* a seed nestled in the soil */}
          <ellipse cx="32" cy="46" rx="6.5" ry="9" fill="currentColor" opacity={0.9} />
          <path d="M32 39 Q35 44 32 50" stroke="var(--dusk-ink)" strokeWidth="1.2" opacity={0.5} fill="none" />
        </g>
      )}

      {status === "sprout" && (
        <g stroke="var(--sprout)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          {/* stem */}
          <path d="M32 48 Q31 36 32 26" />
          {/* two leaves */}
          <path d="M32 36 Q22 33 20 24 Q30 25 32 34" fill="var(--sprout)" stroke="none" opacity={0.85} />
          <path d="M32 32 Q42 30 45 22 Q35 22 32 30" fill="var(--sprout)" stroke="none" opacity={0.7} />
        </g>
      )}

      {status === "bloom" && (
        <g>
          {/* stem + leaf stay green — growth */}
          <path
            d="M32 49 Q31 38 32 30"
            stroke="var(--moss)"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M32 40 Q24 38 22 31 Q30 31 32 38" fill="var(--moss)" opacity={0.7} />
          {/* rose petals with a soft lavender back layer for depth */}
          <g fill="var(--wisteria)" opacity={0.55}>
            <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(36 32 22)" />
            <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(108 32 22)" />
            <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(180 32 22)" />
            <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(252 32 22)" />
            <ellipse cx="32" cy="16.5" rx="4.9" ry="8.4" transform="rotate(324 32 22)" />
          </g>
          <g fill="var(--blush)">
            <ellipse cx="32" cy="18" rx="4.6" ry="8" />
            <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(72 32 22)" />
            <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(144 32 22)" />
            <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(216 32 22)" />
            <ellipse cx="32" cy="18" rx="4.6" ry="8" transform="rotate(288 32 22)" />
          </g>
          {/* firefly-gold heart */}
          <circle cx="32" cy="22" r="4.2" fill="var(--firefly-gold)" />
        </g>
      )}
    </svg>
  );
}
