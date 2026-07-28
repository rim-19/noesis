"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { EmptyState } from "./EmptyState";
import { GardenCanvas } from "./GardenCanvas";
import { CompanionWisp } from "./CompanionWisp";
import { StatsPlaque } from "./StatsPlaque";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { ProgressPanel } from "./ProgressPanel";
import { SettingsPanel, type Settings } from "./SettingsPanel";
import { CallScreen } from "./CallScreen";
import { TextCheckpoint } from "./TextCheckpoint";
import { NudgeBanner } from "./NudgeBanner";
import { GoalComposer } from "./GoalComposer";
import { AmbientFireflies } from "./AmbientFireflies";
import { registerServiceWorker, fetchNudges, enablePush } from "@/lib/nudges";
import type { CheckpointResult, EngagementMode, Garden, GraphNode } from "@/lib/types";

type Panel = "none" | "node" | "progress" | "settings";
type Overlay = null | { mode: EngagementMode; node: GraphNode };

const DEFAULT_SETTINGS: Settings = { defaultMode: "call", captions: true, nudges: true };

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("noesis.settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function GardenApp() {
  const [garden, setGarden] = useState<Garden | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [justBloomedId, setJustBloomedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ result: CheckpointResult; topic: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [wilting, setWilting] = useState<{ id: string; topic: string }[]>([]);
  const [vapidKey, setVapidKey] = useState("");
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Load the garden once, register the PWA service worker, and fetch nudges.
  useEffect(() => {
    fetch("/api/garden")
      .then((r) => r.json())
      .then((g: Garden) => setGarden(g))
      .catch(() => setGarden({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));

    registerServiceWorker();
    fetchNudges().then((n) => {
      setWilting(n.wilting);
      setVapidKey(n.vapidPublicKey);
    });
  }, []);

  const updateSettings = useCallback(
    (s: Settings) => {
      setSettings((prev) => {
        // If refresher nudges were just switched on, ask for push permission.
        if (s.nudges && !prev.nudges && vapidKey) {
          enablePush(vapidKey).then((ok) => {
            if (!ok) {
              setHint("Nudges will show in the app; enable notifications to get them on your phone.");
              setTimeout(() => setHint(null), 3200);
            }
          });
        }
        return s;
      });
      try {
        localStorage.setItem("noesis.settings", JSON.stringify(s));
      } catch {
        /* ignore */
      }
    },
    [vapidKey]
  );

  const selectedNode = useMemo(
    () => garden?.nodes.find((n) => n.id === selectedId) ?? null,
    [garden, selectedId]
  );

  const flash = useCallback((msg: string) => {
    setHint(msg);
    setTimeout(() => setHint(null), 2600);
  }, []);

  const generate = useCallback(
    async (goal: string, opts?: { sourceUrl?: string; source?: { name: string; text: string } }) => {
      setGenerating(true);
      try {
        const res = await fetch("/api/garden/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal, sourceUrl: opts?.sourceUrl, source: opts?.source }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "generation failed");
        setGarden(data as Garden);
      } catch (e) {
        flash((e as Error).message || "The gardener couldn't shape that. Try rephrasing.");
      } finally {
        setGenerating(false);
      }
    },
    [flash]
  );

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setPanel(id ? "node" : "none");
  }, []);

  const wakeCompanion = useCallback(() => {
    if (!selectedNode) {
      flash("Tap a node first — then I'll know what to talk about.");
      return;
    }
    setPanel("none");
    setOverlay({ mode: settings.defaultMode === "text" ? "call" : settings.defaultMode, node: selectedNode });
  }, [selectedNode, settings.defaultMode, flash]);

  const refreshNode = useCallback(
    (id: string) => {
      const node = garden?.nodes.find((n) => n.id === id);
      if (node) {
        setSelectedId(id);
        setOverlay({ mode: "call", node });
      }
    },
    [garden]
  );

  const handleResult = useCallback(
    (result: CheckpointResult, updated: Garden) => {
      const node = overlay?.node;
      setGarden(updated);
      setOverlay(null);
      setToast({ result, topic: node?.topic ?? "that one" });
      if (result.next_status === "bloom" && node) {
        setJustBloomedId(node.id);
        setTimeout(() => setJustBloomedId(null), 900);
        // A refreshed node is no longer wilting.
        setWilting((w) => w.filter((x) => x.id !== node.id));
      }
      setTimeout(() => setToast(null), 6000);
    },
    [overlay]
  );

  if (loading) {
    return (
      <div className="dusk-field grid min-h-dvh place-items-center">
        <CompanionWisp state="thinking" size={60} />
      </div>
    );
  }

  const empty = !garden || garden.nodes.length === 0;

  if (empty) {
    return <EmptyState busy={generating} onSubmit={generate} />;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden dusk-field">
      <AmbientFireflies opacity={0.35} />
      <ReactFlowProvider>
        <GardenCanvas
          garden={garden!}
          selectedId={selectedId}
          justBloomedId={justBloomedId}
          onSelect={select}
        />
      </ReactFlowProvider>

      {/* top bar: goal composer + settings */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto w-[min(22rem,72vw)]">
          <GoalComposer variant="compact" busy={generating} onSubmit={generate} />
        </div>
        <button
          onClick={() => setPanel("settings")}
          className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full text-moonlight-dim transition-colors hover:text-moonlight"
          style={{ background: "color-mix(in srgb, var(--dusk-ink-2) 70%, transparent)", border: "1px solid rgba(232,236,241,0.08)" }}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </div>

      {/* refresher nudge, centered near the top */}
      {settings.nudges && !nudgeDismissed && wilting.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
          <NudgeBanner
            wilting={wilting}
            onRefresh={(id) => {
              setNudgeDismissed(true);
              refreshNode(id);
            }}
            onDismiss={() => setNudgeDismissed(true)}
          />
        </div>
      )}

      {/* stats plaque, corner marker */}
      <div className="absolute bottom-4 left-4">
        <StatsPlaque garden={garden!} onOpenProgress={() => setPanel("progress")} />
      </div>

      {/* the ever-present companion wisp, bottom-right */}
      <div className="absolute bottom-5 right-5 flex flex-col items-center gap-1.5">
        <CompanionWisp
          state={justBloomedId ? "bloomed" : "idle"}
          size={62}
          onClick={wakeCompanion}
          label="Wake the companion"
        />
        <span className="data">{selectedNode ? "tap to talk" : "pick a node"}</span>
      </div>

      {/* hint toast */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-moonlight"
            style={{ background: "var(--dusk-ink-3)", border: "1px solid rgba(232,236,241,0.12)" }}
          >
            {hint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* result toast after a checkpoint */}
      <AnimatePresence>{toast && <ResultToast toast={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* panels */}
      <NodeDetailPanel
        node={selectedNode}
        open={panel === "node"}
        onClose={() => setPanel("none")}
        onEngage={(mode) => {
          if (selectedNode) {
            setPanel("none");
            setOverlay({ mode, node: selectedNode });
          }
        }}
      />
      <ProgressPanel
        garden={garden!}
        open={panel === "progress"}
        onClose={() => setPanel("none")}
        onPick={(n) => {
          setSelectedId(n.id);
          setPanel("node");
        }}
      />
      <SettingsPanel
        open={panel === "settings"}
        onClose={() => setPanel("none")}
        settings={settings}
        onChange={updateSettings}
      />

      {/* full-screen engagement overlays */}
      <AnimatePresence>
        {overlay && (overlay.mode === "call" || overlay.mode === "listen") && (
          <CallScreen
            key="call"
            node={overlay.node}
            mode={overlay.mode}
            onClose={() => setOverlay(null)}
            onResult={handleResult}
          />
        )}
        {overlay && overlay.mode === "text" && (
          <TextCheckpoint
            key="text"
            node={overlay.node}
            onClose={() => setOverlay(null)}
            onResult={handleResult}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultToast({ toast, onClose }: { toast: { result: CheckpointResult; topic: string }; onClose: () => void }) {
  const bloomed = toast.result.next_status === "bloom";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-6 left-1/2 z-30 w-[min(420px,92vw)] -translate-x-1/2 rounded-2xl p-4"
      style={{ background: "var(--dusk-ink-3)", border: `1px solid ${bloomed ? "rgba(231,143,179,0.5)" : "rgba(139,176,138,0.35)"}` }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg">{bloomed ? "🌸" : "🌱"}</span>
        <div className="flex-1">
          <p className="spoken text-[15px] text-moonlight">{toast.result.companion_note}</p>
          {toast.result.gaps.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {toast.result.gaps.map((g, i) => (
                <li key={i} className="data" style={{ color: "var(--moonlight-dim)" }}>
                  • {g}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={onClose} className="data hover:text-moonlight" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </motion.div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
