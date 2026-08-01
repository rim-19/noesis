import "server-only";
import { headers } from "next/headers";

/**
 * The current user's id, set by middleware on every request. This is an
 * anonymous per-device id today; when real auth lands it will resolve to the
 * signed-in account id instead — callers don't change.
 */
export async function getUserId(): Promise<string> {
  const h = await headers();
  const uid = h.get("x-noesis-uid");
  if (!uid) throw new Error("Missing user identity");
  return uid;
}
