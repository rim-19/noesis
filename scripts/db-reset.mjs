// One-off: drop all Noesis tables on the configured database so the app
// recreates them with the current per-user schema. Destroys existing data
// (intended — the old data used a shared, schema-less-of-user_id layout).
// Run with: node scripts/db-reset.mjs
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

// Load DATABASE_URL / DATABASE_AUTH_TOKEN from .env (node doesn't auto-load it).
const env = {};
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {}

const url = env.DATABASE_URL || "file:noesis.db";
const authToken = env.DATABASE_AUTH_TOKEN || undefined;
const c = createClient({ url, authToken });

const TABLES = [
  "subjects", "nodes", "edges", "resources", "messages",
  "checkpoint_results", "push_subscriptions",
  // legacy tables from the old schema
  "call_sessions", "transcripts",
];

console.log("Resetting database at:", url.replace(/\/\/[^.]*/, "//***"));
for (const t of TABLES) {
  await c.execute(`DROP TABLE IF EXISTS ${t}`);
  console.log("dropped", t);
}
console.log("Done. The app will recreate the current schema on next request.");
