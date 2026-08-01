"use client";

import { SlidePanel } from "./SlidePanel";

export interface Settings {
  nudges: boolean;
}

/** Quiet, minimal settings. */
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
        <Toggle
          label="Refresher nudges"
          hint="Get reminded when a bloomed concept starts to fade."
          on={settings.nudges}
          onToggle={() => onChange({ ...settings, nudges: !settings.nudges })}
        />

        <p className="data pt-2 leading-relaxed">
          The tutor teaches by text or voice — a natural voice when available, otherwise your browser&apos;s
          built-in speech. Your garden is private to this device and saved automatically.
        </p>
      </div>
    </SlidePanel>
  );
}

function Toggle({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-start justify-between gap-4 text-left">
      <span>
        <span className="block text-sm text-moonlight-dim">{label}</span>
        {hint && <span className="data mt-0.5 block">{hint}</span>}
      </span>
      <span className="mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors" style={{ background: on ? "var(--moss)" : "rgba(255,255,255,0.14)" }}>
        <span className="h-5 w-5 rounded-full bg-moonlight transition-transform" style={{ transform: on ? "translateX(20px)" : "translateX(0)" }} />
      </span>
    </button>
  );
}
