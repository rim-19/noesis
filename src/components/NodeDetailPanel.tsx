"use client";

import { useState } from "react";
import { SlidePanel } from "./SlidePanel";
import { GrowthStage } from "./GrowthStage";
import type { GraphNode, NodeStatus } from "@/lib/types";

const STATUS_LINE: Record<NodeStatus, string> = {
  seed: "You haven't started this one. Sit down with the tutor and learn it.",
  sprout: "You're learning this. Keep going — or check your understanding when ready.",
  bloom: "You've proven you understand this. 🌸",
};

const TYPE_LEAF: Record<string, string> = { video: "▶", doc: "❖", article: "✦" };

export function NodeDetailPanel({
  node,
  open,
  onClose,
  onLearn,
  onCheckpoint,
  onRename,
  onDelete,
}: {
  node: GraphNode | null;
  open: boolean;
  onClose: () => void;
  onLearn: () => void;
  onCheckpoint: () => void;
  onRename: (topic: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <SlidePanel open={open && !!node} onClose={onClose} title={node ? "a concept in your garden" : ""}>
      {node && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center pt-2 text-center">
            <div className="grid place-items-center rounded-full p-3" style={{ background: node.status === "bloom" ? "radial-gradient(circle, rgba(239,157,191,0.22) 0%, transparent 70%)" : "radial-gradient(circle, rgba(91,155,115,0.18) 0%, transparent 70%)" }}>
              <GrowthStage status={node.status} size={104} />
            </div>
            {renaming ? (
              <div className="mt-3 flex w-full items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onRename(name.trim()); setRenaming(false); } }}
                  className="flex-1 rounded-lg bg-transparent px-3 py-1.5 text-center font-display text-lg outline-none"
                  style={{ border: "1px solid var(--dusk-line)", color: "var(--moonlight)" }}
                />
                <button onClick={() => { if (name.trim()) { onRename(name.trim()); } setRenaming(false); }} className="data hover:text-moonlight">save</button>
              </div>
            ) : (
              <h2 className="spoken mt-3 text-xl text-moonlight">{node.topic}</h2>
            )}
            <p className="mt-2 max-w-[18rem] text-sm text-moonlight-dim">{node.concept_summary}</p>
          </div>

          <p className="rounded-xl px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", color: "var(--moonlight-dim)" }}>
            {STATUS_LINE[node.status]}
          </p>

          {/* actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onLearn}
              className="flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
              style={{ background: "linear-gradient(180deg, rgba(245,205,118,0.18), rgba(245,205,118,0.07))", border: "1px solid rgba(245,205,118,0.4)" }}
            >
              <span>
                <span className="block font-display text-[15px]" style={{ color: "var(--firefly-gold)" }}>
                  {node.status === "seed" ? "Learn this" : node.status === "bloom" ? "Revisit the lesson" : "Continue learning"}
                </span>
                <span className="data">chat or talk it through with the tutor</span>
              </span>
              <span className="text-moonlight-faint">→</span>
            </button>

            <button
              onClick={onCheckpoint}
              className="flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
              style={{ border: "1px solid var(--dusk-line)" }}
            >
              <span>
                <span className="block font-display text-[15px] text-moonlight">Check my understanding</span>
                <span className="data">explain it back — prove it bloomed</span>
              </span>
              <span className="text-moonlight-faint">→</span>
            </button>
          </div>

          {/* resources */}
          <div>
            <div className="data mb-2">go deeper</div>
            <ul className="flex flex-col gap-1.5">
              {node.resources.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]" style={{ border: "1px solid var(--dusk-line)" }}>
                    <span style={{ color: r.user_provided ? "var(--firefly-gold)" : "var(--sprout)" }}>{TYPE_LEAF[r.type] ?? "✦"}</span>
                    <span className="flex-1 truncate text-moonlight">{r.title}</span>
                    {r.user_provided && <span className="data">yours</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* manage */}
          <div className="flex items-center gap-3 border-t pt-4" style={{ borderColor: "var(--dusk-line)" }}>
            <button onClick={() => { setRenaming(true); setName(node.topic); }} className="data hover:text-moonlight transition-colors">rename</button>
            {confirmDelete ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-moonlight-dim">remove this concept?</span>
                <button onClick={onDelete} className="text-firefly-gold">yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-moonlight-faint">no</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="data hover:text-firefly-gold transition-colors">remove</button>
            )}
          </div>
        </div>
      )}
    </SlidePanel>
  );
}
