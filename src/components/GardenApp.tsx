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
import { LessonChat } from "./LessonChat";
import { Checkpoint } from "./Checkpoint";
import { NudgeBanner } from "./NudgeBanner";
import { SurpriseModal } from "./SurpriseModal";
import { GoalComposer } from "./GoalComposer";
import { AmbientFireflies } from "./AmbientFireflies";
import { registerServiceWorker, fetchNudges, enablePush } from "@/lib/nudges";
import type { CheckpointResult, Garden, GraphNode } from "@/lib/types";

type Panel = "none" | "node" | "progress" | "settings";
type Overlay = null | { kind: "learn" | "checkpoint"; node: GraphNode };

const DEFAULT_SETTINGS: Settings = { nudges: true };

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
  const [surpriseOpen, setSurpriseOpen] = useState(false);

  useEffect(() => {
    fetch("/api/garden")
      .then((r) => r.json())
      .then((g: Garden) => setGarden(g))
      .catch(() => setGarden({ subjects: [], nodes: [], edges: [] }))
      .finally(() => setLoading(false));
    registerServiceWorker();
    fetchNudges().then((n) => {
      setWilting(n.wilting);
      setVapidKey(n.vapidPublicKey);
    });
  }, []);

  const flash = useCallback((msg: string) => {
    setHint(msg);
    setTimeout(() => setHint(null), 3000);
  }, []);

  const updateSettings = useCallback(
    (s: Settings) => {
      setSettings((prev) => {
        if (s.nudges && !prev.nudges && vapidKey) {
          enablePush(vapidKey).then((ok) => {
            if (!ok) flash("Nudges will show in the app; allow notifications to also get them on your phone.");
          });
        }
        return s;
      });
      try { localStorage.setItem("noesis.settings", JSON.stringify(s)); } catch {}
    },
    [vapidKey, flash]
  );

  const selectedNode = useMemo(() => garden?.nodes.find((n) => n.id === selectedId) ?? null, [garden, selectedId]);
  const subjectTitle = useMemo(
    () => garden?.subjects.find((s) => s.id === selectedNode?.subject_id)?.title ?? "",
    [garden, selectedNode]
  );

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
        setGarden(data.garden as Garden);
      } catch (e) {
        flash((e as Error).message || "Couldn't shape that. Try rephrasing.");
      } finally {
        setGenerating(false);
      }
    },
    [flash]
  );

  const surpriseMe = useCallback(async () => {
    setGenerating(true);
    try {
      const seed = `${Math.random().toString(36).slice(2)}-${Math.floor(Math.random() * 1e9)}`;
      const res = await fetch("/api/garden/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surprise: true, seed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generation failed");
      setGarden(data.garden as Garden);
      setSurpriseOpen(false);
    } catch (e) {
      flash((e as Error).message || "Couldn't pick something. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [flash]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setPanel(id ? "node" : "none");
  }, []);

  const openLearn = useCallback((node: GraphNode) => { setPanel("none"); setOverlay({ kind: "learn", node }); }, []);
  const openCheckpoint = useCallback((node: GraphNode) => { setPanel("none"); setOverlay({ kind: "checkpoint", node }); }, []);

  const markSprout = useCallback((nodeId: string) => {
    setGarden((g) => g && { ...g, nodes: g.nodes.map((n) => (n.id === nodeId && n.status === "seed" ? { ...n, status: "sprout" } : n)) });
  }, []);

  const handleCheckpointResult = useCallback((result: CheckpointResult, updated: Garden) => {
    const node = overlay?.node;
    setGarden(updated);
    setToast({ result, topic: node?.topic ?? "that one" });
    if (result.next_status === "bloom" && node) {
      setJustBloomedId(node.id);
      setTimeout(() => setJustBloomedId(null), 900);
      setWilting((w) => w.filter((x) => x.id !== node.id));
    }
    setTimeout(() => setToast(null), 6000);
  }, [overlay]);

  const renameNode = useCallback(async (id: string, topic: string) => {
    const res = await fetch(`/api/nodes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
    const data = await res.json();
    if (res.ok) setGarden(data.garden as Garden);
  }, []);

  const deleteNode = useCallback(async (id: string) => {
    const res = await fetch(`/api/nodes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { setGarden(data.garden as Garden); setPanel("none"); setSelectedId(null); }
  }, []);

  const deleteSubject = useCallback(async (id: string) => {
    const res = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) setGarden(data.garden as Garden);
  }, []);

  const resetGarden = useCallback(async () => {
    const res = await fetch("/api/garden/reset", { method: "POST" });
    const data = await res.json();
    if (res.ok) { setGarden(data.garden as Garden); setPanel("none"); setSelectedId(null); }
  }, []);

  const wake = useCallback(() => {
    if (!selectedNode) { flash("Tap a concept first — then I'll teach it."); return; }
    openLearn(selectedNode);
  }, [selectedNode, openLearn, flash]);

  if (loading) {
    return <div className="dusk-field grid min-h-dvh place-items-center"><CompanionWisp state="thinking" size={60} /></div>;
  }

  const empty = !garden || garden.nodes.length === 0;
  if (empty) {
    return (
      <>
        <EmptyState busy={generating} onSubmit={generate} onSurprise={() => setSurpriseOpen(true)} />
        <SurpriseModal open={surpriseOpen} busy={generating} onPick={surpriseMe} onClose={() => setSurpriseOpen(false)} />
      </>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden dusk-field">
      <AmbientFireflies opacity={0.3} />
      <ReactFlowProvider>
        <GardenCanvas garden={garden!} selectedId={selectedId} justBloomedId={justBloomedId} onSelect={select} />
      </ReactFlowProvider>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto w-[min(22rem,72vw)]">
          <GoalComposer variant="compact" busy={generating} onSubmit={generate} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button onClick={() => setSurpriseOpen(true)} disabled={generating} title="Surprise me — pick any subject" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg transition-colors hover:text-moonlight disabled:opacity-40" style={{ background: "color-mix(in srgb, var(--dusk-ink-2) 80%, transparent)", border: "1px solid var(--dusk-line)" }} aria-label="Surprise me">
            🎲
          </button>
          <button onClick={() => setPanel("settings")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-moonlight-dim transition-colors hover:text-moonlight" style={{ background: "color-mix(in srgb, var(--dusk-ink-2) 80%, transparent)", border: "1px solid var(--dusk-line)" }} aria-label="Settings">
            <GearIcon />
          </button>
        </div>
      </div>

      {generating && (
        <div className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-moonlight" style={{ background: "var(--dusk-ink-3)", border: "1px solid var(--dusk-line)" }}>
          🌱 planning your path… this can take a moment
        </div>
      )}

      {settings.nudges && !nudgeDismissed && wilting.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
          <NudgeBanner wilting={wilting} onRefresh={(id) => { const n = garden!.nodes.find((x) => x.id === id); setNudgeDismissed(true); if (n) openCheckpoint(n); }} onDismiss={() => setNudgeDismissed(true)} />
        </div>
      )}

      <div className="absolute bottom-4 left-4">
        <StatsPlaque garden={garden!} onOpenProgress={() => setPanel("progress")} />
      </div>

      <div className="absolute bottom-5 right-5 flex flex-col items-center gap-1.5">
        <CompanionWisp state={justBloomedId ? "bloomed" : "idle"} size={62} onClick={wake} label="Learn the selected concept" />
        <span className="data">{selectedNode ? "tap to learn" : "pick a concept"}</span>
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-moonlight" style={{ background: "var(--dusk-ink-3)", border: "1px solid var(--dusk-line)" }}>
            {hint}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <ResultToast toast={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <NodeDetailPanel
        node={selectedNode}
        open={panel === "node"}
        onClose={() => setPanel("none")}
        onLearn={() => selectedNode && openLearn(selectedNode)}
        onCheckpoint={() => selectedNode && openCheckpoint(selectedNode)}
        onRename={(topic) => selectedNode && renameNode(selectedNode.id, topic)}
        onDelete={() => selectedNode && deleteNode(selectedNode.id)}
      />
      <ProgressPanel
        garden={garden!}
        open={panel === "progress"}
        onClose={() => setPanel("none")}
        onPick={(n) => { setSelectedId(n.id); setPanel("node"); }}
        onDeleteSubject={deleteSubject}
        onReset={resetGarden}
      />
      <SettingsPanel open={panel === "settings"} onClose={() => setPanel("none")} settings={settings} onChange={updateSettings} />

      <AnimatePresence>
        {overlay?.kind === "learn" && (
          <LessonChat key="learn" node={overlay.node} subjectTitle={subjectTitle || garden!.subjects.find((s) => s.id === overlay.node.subject_id)?.title || overlay.node.topic} onClose={() => setOverlay(null)} onStarted={() => markSprout(overlay.node.id)} />
        )}
        {overlay?.kind === "checkpoint" && (
          <Checkpoint key="check" node={overlay.node} onClose={() => setOverlay(null)} onResult={handleCheckpointResult} />
        )}
      </AnimatePresence>

      <SurpriseModal open={surpriseOpen} busy={generating} onPick={surpriseMe} onClose={() => setSurpriseOpen(false)} />
    </div>
  );
}

function ResultToast({ toast, onClose }: { toast: { result: CheckpointResult; topic: string }; onClose: () => void }) {
  const bloomed = toast.result.next_status === "bloom";
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-6 left-1/2 z-30 w-[min(420px,92vw)] -translate-x-1/2 rounded-2xl p-4" style={{ background: "var(--dusk-ink-3)", border: `1px solid ${bloomed ? "rgba(239,157,191,0.5)" : "var(--dusk-line)"}` }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg">{bloomed ? "🌸" : "🌱"}</span>
        <div className="flex-1">
          <p className="spoken text-[15px] text-moonlight">{toast.result.companion_note}</p>
          {toast.result.gaps.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {toast.result.gaps.map((g, i) => <li key={i} className="data" style={{ color: "var(--moonlight-dim)" }}>• {g}</li>)}
            </ul>
          )}
        </div>
        <button onClick={onClose} className="data hover:text-moonlight" aria-label="Dismiss">✕</button>
      </div>
    </motion.div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
