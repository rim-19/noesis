// Storage layer — libsql (SQLite-compatible). Local dev uses a file; production
// uses a hosted libsql/Turso database (see DATABASE_URL / DATABASE_AUTH_TOKEN).
//
// Every row is scoped to a user_id so gardens are private per user.

import "server-only";
import { createClient, type Client } from "@libsql/client";

let _db: Client | null = null;
let _ready: Promise<void> | null = null;

function client(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.DATABASE_URL || "file:noesis.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return _db;
}

const SCHEMA = [
  // A subject is one learning goal and forms one visual cluster in the garden.
  `CREATE TABLE IF NOT EXISTS subjects (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     title TEXT NOT NULL,
     goal TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS nodes (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     subject_id TEXT NOT NULL DEFAULT '',
     topic TEXT NOT NULL,
     concept_summary TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'seed',
     depth INTEGER NOT NULL DEFAULT 0,
     x REAL NOT NULL DEFAULT 0,
     y REAL NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     last_verified_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS edges (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     subject_id TEXT NOT NULL DEFAULT '',
     from_node_id TEXT NOT NULL,
     to_node_id TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS resources (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     node_id TEXT NOT NULL,
     url TEXT NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     type TEXT NOT NULL DEFAULT 'article',
     rank INTEGER NOT NULL DEFAULT 1,
     user_provided INTEGER NOT NULL DEFAULT 0
   )`,
  // The persistent teaching conversation for a node (text + voice, one thread).
  `CREATE TABLE IF NOT EXISTS messages (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     node_id TEXT NOT NULL,
     role TEXT NOT NULL,
     content TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS checkpoint_results (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     node_id TEXT NOT NULL,
     understood INTEGER NOT NULL,
     confidence REAL NOT NULL,
     gaps TEXT NOT NULL DEFAULT '[]',
     follow_up_needed INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     endpoint TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     data TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_user ON nodes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_edges_user ON edges(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_node ON messages(user_id, node_id)`,
];

// Columns added after the initial schema. ALTER fails if the column already
// exists, so each is wrapped and ignored — safe on fresh and existing DBs.
const MIGRATIONS = [
  `ALTER TABLE subjects ADD COLUMN language TEXT NOT NULL DEFAULT ''`,
];

export async function db(): Promise<Client> {
  const c = client();
  if (!_ready) {
    _ready = (async () => {
      for (const stmt of SCHEMA) await c.execute(stmt);
      for (const stmt of MIGRATIONS) {
        try { await c.execute(stmt); } catch { /* column already exists */ }
      }
    })();
  }
  await _ready;
  return c;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
