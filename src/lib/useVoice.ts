"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cross-browser voice loop.
 *
 *   listen() -> records the mic (MediaRecorder), detects when you stop talking,
 *               and transcribes via /api/stt (ElevenLabs Scribe).
 *   speak()  -> ElevenLabs voice via /api/tts, falling back to browser speech.
 *
 * Unlike the old Web Speech API version this works in Safari, Firefox and on
 * mobile — not just Chrome.
 */

// Voice-activity tuning.
const SILENCE_THRESHOLD = 0.018; // normalized RMS below this counts as silence
const SILENCE_HOLD_MS = 1300; // stop this long after the learner stops talking
const NO_SPEECH_TIMEOUT_MS = 7000; // give up if they never start
const MAX_UTTERANCE_MS = 45000; // hard cap on a single turn

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported?.(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function useVoice() {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0); // live mic level 0..1, for the waveform

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopFlagRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasMic = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    setSupported(hasMic);

    if ("speechSynthesis" in window) {
      const pick = () => {
        const voices = window.speechSynthesis.getVoices();
        voiceRef.current =
          voices.find((v) => /en(-|_)?(GB|US)/i.test(v.lang) && /female|samantha|google/i.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0] ||
          null;
      };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }

    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioRef.current?.pause();
    };
  }, []);

  /** Acquire (once) and reuse the mic stream so turns don't re-prompt or lag. */
  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current?.active) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;

      return stream;
    } catch {
      return null;
    }
  }, []);

  /** Current normalized loudness (RMS) from the analyser. */
  const readLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }, []);

  /**
   * Record one utterance, stop on silence, transcribe it.
   * Resolves with the transcript (empty string if nothing was said).
   */
  const listen = useCallback(async (): Promise<string> => {
    const stream = await ensureStream();
    if (!stream) {
      setSupported(false);
      return "";
    }

    const mime = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      return "";
    }
    recorderRef.current = recorder;
    stopFlagRef.current = false;

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const spokeRef = { current: false };

    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(120);
    setListening(true);

    // Voice-activity loop: stop shortly after they finish talking.
    const started = Date.now();
    let lastLoud = 0;
    await new Promise<void>((resolve) => {
      const tick = window.setInterval(() => {
        const lvl = readLevel();
        setLevel(lvl);
        const now = Date.now();

        if (lvl > SILENCE_THRESHOLD) {
          spokeRef.current = true;
          lastLoud = now;
        }

        const elapsed = now - started;
        const doneTalking = spokeRef.current && lastLoud && now - lastLoud > SILENCE_HOLD_MS;
        const neverSpoke = !spokeRef.current && elapsed > NO_SPEECH_TIMEOUT_MS;
        const tooLong = elapsed > MAX_UTTERANCE_MS;

        if (stopFlagRef.current || doneTalking || neverSpoke || tooLong) {
          window.clearInterval(tick);
          resolve();
        }
      }, 100);
    });

    if (recorder.state !== "inactive") recorder.stop();
    await finished;
    setListening(false);
    setLevel(0);
    recorderRef.current = null;

    if (!spokeRef.current || chunks.length === 0) return "";

    const blob = new Blob(chunks, { type: mime || "audio/webm" });
    if (blob.size < 2000) return "";

    setTranscribing(true);
    try {
      const ext = (mime.includes("mp4") && "mp4") || (mime.includes("ogg") && "ogg") || "webm";
      const fd = new FormData();
      fd.append("audio", blob, `speech.${ext}`);
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      if (!res.ok) return "";
      const data = await res.json();
      return String(data.text ?? "").trim();
    } catch {
      return "";
    } finally {
      setTranscribing(false);
    }
  }, [ensureStream, readLevel]);

  /** Force the current utterance to end (user tapped "done"). */
  const stopListening = useCallback(() => {
    stopFlagRef.current = true;
  }, []);

  /** Browser SpeechSynthesis fallback. */
  const speakBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
        return resolve();
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 1.0;
      u.pitch = 1.02;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        resolve();
      };
      u.onerror = () => {
        setSpeaking(false);
        resolve();
      };
      window.speechSynthesis.speak(u);
    });
  }, []);

  /** Speak a line with the ElevenLabs voice, falling back to browser speech. */
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok || !res.headers.get("content-type")?.includes("audio")) {
          return speakBrowser(text);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplay = () => setSpeaking(true);
          const done = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onended = done;
          audio.onerror = done;
          audio.play().catch(() => {
            URL.revokeObjectURL(url);
            speakBrowser(text).then(resolve);
          });
        });
      } catch {
        return speakBrowser(text);
      }
    },
    [speakBrowser]
  );

  const shutUp = useCallback(() => {
    stopFlagRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSpeaking(false);
    setListening(false);
  }, []);

  return { supported, listening, speaking, transcribing, level, listen, stopListening, speak, shutUp };
}
