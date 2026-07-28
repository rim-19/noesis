"use client";

// Client helpers for the PWA service worker + refresher push subscription.

export interface NudgeInfo {
  wilting: { id: string; topic: string }[];
  vapidPublicKey: string;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function fetchNudges(): Promise<NudgeInfo> {
  try {
    const res = await fetch("/api/nudges");
    if (!res.ok) return { wilting: [], vapidPublicKey: "" };
    return await res.json();
  } catch {
    return { wilting: [], vapidPublicKey: "" };
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Ask permission and subscribe to push. Returns true on success. Requires the
 * server to have VAPID keys configured (vapidPublicKey non-empty).
 */
export async function enablePush(vapidPublicKey: string): Promise<boolean> {
  if (!vapidPublicKey) return false;
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  return res.ok;
}
