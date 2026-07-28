// Storage layer — libsql (SQLite-compatible, prebuilt, no native build needed).
// The DB file lives at ./noesis.db in the project root.

import "server-only";
import { createClient, type Client } from "@libsql/client";

let _db: Client | null = null;
let _ready: Promise<void> | null = null;

function client(): Client {
  if (!_db) {
    // Local dev: a file (file:noesis.db). Production: a hosted libsql/Turso URL
    // (libsql://...) which also needs an auth token. The token is ignored for
    // file: URLs, so this works in both environments.
    _db = createClient({
      url: process.env.DATABASE_URL || "file:noesis.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return _db;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS nodes (
     id TEXT PRIMARY KEY,
     topic TEXT NOT NULL,
     concept_summary TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'seed',
     x REAL NOT NULL DEFAULT 0,
     y REAL NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     last_verified_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS edges (
     id TEXT PRIMARY KEY,
     from_node_id TEXT NOT NULL,
     to_node_id TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS resources (
     id TEXT PRIMARY KEY,
     node_id TEXT NOT NULL,
     url TEXT NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     type TEXT NOT NULL DEFAULT 'article',
     rank INTEGER NOT NULL DEFAULT 1,
     user_provided INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS call_sessions (
     id TEXT PRIMARY KEY,
     node_id TEXT NOT NULL,
     mode TEXT NOT NULL,
     started_at INTEGER NOT NULL,
     ended_at INTEGER,
     audio_ref TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS transcripts (
     id TEXT PRIMARY KEY,
     session_id TEXT NOT NULL,
     speaker TEXT NOT NULL,
     text TEXT NOT NULL,
     timestamp INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS checkpoint_results (
     id TEXT PRIMARY KEY,
     session_id TEXT NOT NULL,
     understood INTEGER NOT NULL,
     confidence REAL NOT NULL,
     gaps TEXT NOT NULL DEFAULT '[]',
     follow_up_needed INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     endpoint TEXT PRIMARY KEY,
     data TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
];

/** Ensure schema exists exactly once per process. */
export async function db(): Promise<Client> {
  const c = client();
  if (!_ready) {
    _ready = (async () => {
      for (const stmt of SCHEMA) await c.execute(stmt);
    })();
  }
  await _ready;
  return c;
}

export function newId(prefix: string): string {
  // crypto.randomUUID is available in the Node/Edge runtimes Next uses.
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
