"use client";

import type { Garden } from "@/lib/types";

/**
 * A small garden marker tucked in the corner — a plaque, not a dashboard
 * widget row. Streak + what's bloomed lately, quiet and unobtrusive.
 */
export function StatsPlaque({ garden, onOpenProgress }: { garden: Garden; onOpenProgress: () => void }) {
  const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const bloomedThisWeek = garden.nodes.filter(
    (n) => n.status === "bloom" && (n.last_verified_at ?? 0) >= week
  ).length;
  const growing = garden.nodes.filter((n) => n.status === "sprout").length;
  const total = garden.nodes.length;

  return (
    <button
      onClick={onOpenProgress}
      className="group flex flex-col gap-1 rounded-xl px-3.5 py-2.5 text-left transition-colors"
      style={{
        background: "color-mix(in srgb, var(--dusk-ink-2) 70%, transparent)",
        border: "1px solid rgba(232,236,241,0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span className="data" style={{ color: "var(--moonlight-faint)" }}>
        your garden
      </span>
      <span className="font-display text-sm text-moonlight">
        {bloomedThisWeek > 0 ? (
          <>
            {bloomedThisWeek} bloomed this week
          </>
        ) : (
          <>{total} planted so far</>
        )}
      </span>
      <span className="data group-hover:text-moonlight-dim transition-colors">
        {growing > 0 ? `${growing} still growing →` : "see the whole garden →"}
      </span>
    </button>
  );
}
