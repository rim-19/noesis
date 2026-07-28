"use client";

import { SlidePanel } from "./SlidePanel";
import { GrowthStage } from "./GrowthStage";
import type { EngagementMode, GraphNode, NodeStatus } from "@/lib/types";

const STATUS_LINE: Record<NodeStatus, string> = {
  seed: "This one's still a seed. Nothing planted here yet — talk it through to start it growing.",
  sprout: "This one's sprouting. Almost there — one more good pass and it'll bloom.",
  bloom: "This one's bloomed. You proved you understand it.",
};

const TYPE_LEAF: Record<string, string> = { video: "▶", doc: "❖", article: "✦" };

export function NodeDetailPanel({
  node,
  open,
  onClose,
  onEngage,
}: {
  node: GraphNode | null;
  open: boolean;
  onClose: () => void;
  onEngage: (mode: EngagementMode) => void;
}) {
  return (
    <SlidePanel open={open && !!node} onClose={onClose} title={node ? "a node in your garden" : ""}>
      {node && (
        <div className="flex flex-col gap-6">
          {/* growth-stage illustration, large */}
          <div className="flex flex-col items-center pt-2 text-center">
            <div
              className="grid place-items-center rounded-full p-3"
              style={{
                background:
                  node.status === "bloom"
                    ? "radial-gradient(circle, rgba(231,143,179,0.22) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(63,107,79,0.18) 0%, transparent 70%)",
              }}
            >
              <GrowthStage status={node.status} size={104} />
            </div>
            <h2 className="spoken mt-3 text-xl text-moonlight">{node.topic}</h2>
            <p className="mt-2 max-w-[18rem] text-sm text-moonlight-dim">{node.concept_summary}</p>
          </div>

          <p
            className="rounded-xl px-3.5 py-3 text-[13px] leading-relaxed"
            style={{ background: "rgba(232,236,241,0.04)", color: "var(--moonlight-dim)" }}
          >
            {STATUS_LINE[node.status]}
          </p>

          {/* engagement actions */}
          <div className="flex flex-col gap-2.5">
            <EngageButton
              primary
              title="Wake the companion"
              sub="talk it through by voice"
              onClick={() => onEngage("call")}
            />
            <EngageButton title="Write it out" sub="type your explanation" onClick={() => onEngage("text")} />
            <EngageButton title="Explain to me" sub="just listen for now" onClick={() => onEngage("listen")} />
          </div>

          {/* resources as leaves */}
          <div>
            <div className="data mb-2">what&apos;s growing here</div>
            {node.resources.length === 0 ? (
              <p className="text-sm text-moonlight-faint">No sources tucked in yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {node.resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[rgba(232,236,241,0.05)]"
                      style={{ border: "1px solid rgba(232,236,241,0.07)" }}
                    >
                      <span style={{ color: r.user_provided ? "var(--firefly-gold)" : "var(--sprout)" }}>
                        {TYPE_LEAF[r.type] ?? "✦"}
                      </span>
                      <span className="flex-1 truncate text-moonlight">{r.title}</span>
                      {r.user_provided && <span className="data">yours</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {node.last_verified_at && (
            <div className="data">
              last verified {new Date(node.last_verified_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </SlidePanel>
  );
}

function EngageButton({
  title,
  sub,
  onClick,
  primary,
}: {
  title: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition-transform active:scale-[0.98]"
      style={
        primary
          ? {
              background: "linear-gradient(180deg, rgba(242,196,100,0.16), rgba(242,196,100,0.06))",
              border: "1px solid rgba(242,196,100,0.35)",
            }
          : { border: "1px solid rgba(232,236,241,0.10)" }
      }
    >
      <span>
        <span
          className="block font-display text-[15px]"
          style={{ color: primary ? "var(--firefly-gold)" : "var(--moonlight)" }}
        >
          {title}
        </span>
        <span className="data">{sub}</span>
      </span>
      <span className="text-moonlight-faint">→</span>
    </button>
  );
}
