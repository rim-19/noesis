"use client";

import { useState } from "react";
import { SlidePanel } from "./SlidePanel";
import { GrowthStage } from "./GrowthStage";
import type { Garden, GraphNode } from "@/lib/types";

const STALE_MS = 21 * 24 * 60 * 60 * 1000;

export function ProgressPanel({
  garden,
  open,
  onClose,
  onPick,
  onDeleteSubject,
  onReset,
}: {
  garden: Garden;
  open: boolean;
  onClose: () => void;
  onPick: (node: GraphNode) => void;
  onDeleteSubject: (id: string) => void;
  onReset: () => void;
}) {
  const [confirmSubject, setConfirmSubject] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const bloomed = garden.nodes.filter((n) => n.status === "bloom");
  const growing = garden.nodes.filter((n) => n.status === "sprout");
  const now = Date.now();
  const wilting = bloomed.filter((n) => now - (n.last_verified_at ?? now) > STALE_MS);

  return (
    <SlidePanel open={open} onClose={onClose} title="your garden" width={400}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-2">
          <Tally n={bloomed.length} label="bloomed" color="var(--blush)" />
          <Tally n={growing.length} label="learning" color="var(--sprout)" />
          <Tally n={garden.nodes.length} label="planted" color="var(--seed-gray)" />
        </div>

        {/* subjects */}
        <div>
          <div className="data mb-2">subjects you&apos;re growing</div>
          {garden.subjects.length === 0 ? (
            <p className="text-sm text-moonlight-dim">Nothing yet — plant a goal to begin.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {garden.subjects.map((s) => {
                const total = garden.nodes.filter((n) => n.subject_id === s.id).length;
                const done = garden.nodes.filter((n) => n.subject_id === s.id && n.status === "bloom").length;
                return (
                  <li key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--dusk-line)" }}>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-display text-sm text-moonlight">{s.title}</span>
                      <span className="data">{done}/{total} bloomed</span>
                    </span>
                    {confirmSubject === s.id ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <button onClick={() => { onDeleteSubject(s.id); setConfirmSubject(null); }} className="text-firefly-gold">delete</button>
                        <button onClick={() => setConfirmSubject(null)} className="text-moonlight-faint">cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmSubject(s.id)} aria-label="Delete subject" className="text-moonlight-faint transition-colors hover:text-firefly-gold">✕</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* wilting */}
        {wilting.length > 0 && (
          <div>
            <div className="data mb-2">wilting a little</div>
            <ul className="flex flex-col gap-2">
              {wilting.map((n) => (
                <li key={n.id}>
                  <button onClick={() => onPick(n)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)]" style={{ border: "1px solid var(--dusk-line)" }}>
                    <GrowthStage status={n.status} size={34} />
                    <span className="flex-1">
                      <span className="block font-display text-sm text-moonlight">{n.topic}</span>
                      <span className="data">a quick refresher?</span>
                    </span>
                    <span className="text-firefly-gold">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* reset */}
        <div className="border-t pt-4" style={{ borderColor: "var(--dusk-line)" }}>
          {confirmReset ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-moonlight-dim">Clear the whole garden?</span>
              <span className="flex gap-2">
                <button onClick={() => { onReset(); setConfirmReset(false); }} className="text-firefly-gold">yes, clear it</button>
                <button onClick={() => setConfirmReset(false)} className="text-moonlight-faint">cancel</button>
              </span>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="data hover:text-firefly-gold transition-colors">clear everything and start over</button>
          )}
        </div>
      </div>
    </SlidePanel>
  );
}

function Tally({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--dusk-line)" }}>
      <span className="font-display text-2xl" style={{ color }}>{n}</span>
      <span className="data">{label}</span>
    </div>
  );
}
