"use client";

import { SlidePanel } from "./SlidePanel";
import type { EngagementMode } from "@/lib/types";

export interface Settings {
  defaultMode: EngagementMode;
  captions: boolean;
  nudges: boolean;
}

/** The restrained moment — quiet, minimal, no garden theming. */
export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  return (
    <SlidePanel open={open} onClose={onClose} title="settings" width={360}>
      <div className="flex flex-col gap-7 pt-2">
        <Field label="Default way to engage">
          <div className="flex gap-1.5">
            {(["call", "text", "listen"] as EngagementMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onChange({ ...settings, defaultMode: m })}
                className="flex-1 rounded-lg py-2 text-sm capitalize transition-colors"
                style={
                  settings.defaultMode === m
                    ? { background: "rgba(232,236,241,0.10)", color: "var(--moonlight)" }
                    : { color: "var(--moonlight-faint)" }
                }
              >
                {m === "listen" ? "listen" : m}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          label="Captions during calls"
          on={settings.captions}
          onToggle={() => onChange({ ...settings, captions: !settings.captions })}
        />
        <Toggle
          label="Refresher nudges"
          hint="Get reminded when a bloomed node starts to wilt."
          on={settings.nudges}
          onToggle={() => onChange({ ...settings, nudges: !settings.nudges })}
        />

        <p className="data pt-4 leading-relaxed">
          The companion speaks with a natural voice when available, falling back to your browser&apos;s
          built-in speech. Turn on refresher nudges to be reminded on your phone when a node wilts.
          Everything you grow is stored locally.
        </p>
      </div>
    </SlidePanel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm text-moonlight-dim">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="flex items-start justify-between gap-4 text-left">
      <span>
        <span className="block text-sm text-moonlight-dim">{label}</span>
        {hint && <span className="data mt-0.5 block">{hint}</span>}
      </span>
      <span
        className="mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors"
        style={{ background: on ? "var(--moss)" : "rgba(232,236,241,0.12)" }}
      >
        <span
          className="h-5 w-5 rounded-full bg-moonlight transition-transform"
          style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
