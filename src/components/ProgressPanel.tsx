"use client";

import { SlidePanel } from "./SlidePanel";
import { GrowthStage } from "./GrowthStage";
import type { Garden, GraphNode } from "@/lib/types";

const STALE_MS = 21 * 24 * 60 * 60 * 1000; // three weeks

export function ProgressPanel({
  garden,
  open,
  onClose,
  onPick,
}: {
  garden: Garden;
  open: boolean;
  onClose: () => void;
  onPick: (node: GraphNode) => void;
}) {
  const bloomed = garden.nodes.filter((n) => n.status === "bloom");
  const growing = garden.nodes.filter((n) => n.status === "sprout");
  const now = Date.now();
  const wilting = bloomed.filter((n) => now - (n.last_verified_at ?? now) > STALE_MS);

  return (
    <SlidePanel open={open} onClose={onClose} title="the whole garden" width={400}>
      <div className="flex flex-col gap-6">
        {/* a quiet tally */}
        <div className="grid grid-cols-3 gap-2">
          <Tally n={bloomed.length} label="bloomed" color="var(--blush)" />
          <Tally n={growing.length} label="growing" color="var(--sprout)" />
          <Tally n={garden.nodes.length} label="planted" color="var(--seed-gray)" />
        </div>

        {/* wilting nodes, in the app's own voice */}
        <div>
          <div className="data mb-2">wilting a little</div>
          {wilting.length === 0 ? (
            <p className="text-sm text-moonlight-dim">
              Nothing&apos;s wilting. Everything you&apos;ve grown is still fresh.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {wilting.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onPick(n)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(232,236,241,0.05)]"
                    style={{ border: "1px solid rgba(232,236,241,0.08)" }}
                  >
                    <GrowthStage status={n.status} size={34} />
                    <span className="flex-1">
                      <span className="block font-display text-sm text-moonlight">{n.topic}</span>
                      <span className="data">this one&apos;s wilting — a quick refresher?</span>
                    </span>
                    <span className="text-firefly-gold">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* everything bloomed */}
        {bloomed.length > 0 && (
          <div>
            <div className="data mb-2">proven</div>
            <div className="flex flex-wrap gap-1.5">
              {bloomed.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onPick(n)}
                  className="rounded-full px-3 py-1.5 text-xs transition-colors hover:bg-[rgba(231,143,179,0.20)]"
                  style={{ border: "1px solid rgba(231,143,179,0.45)", color: "var(--petal)" }}
                >
                  {n.topic}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

function Tally({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div
      className="flex flex-col items-center rounded-xl py-3"
      style={{ background: "rgba(232,236,241,0.03)", border: "1px solid rgba(232,236,241,0.06)" }}
    >
      <span className="font-display text-2xl" style={{ color }}>
        {n}
      </span>
      <span className="data">{label}</span>
    </div>
  );
}
