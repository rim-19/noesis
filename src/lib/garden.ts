// Repository + AI orchestration for the garden: load, generate, converse, grade.

import "server-only";
import { db, newId } from "./db";
import { generate, parseJsonObject, type ChatMessage } from "./ai";
import type {
  Garden,
  GraphNode,
  GraphEdge,
  Resource,
  NodeStatus,
  CheckpointResult,
  Turn,
} from "./types";

// ---------- Load ----------

export async function loadGarden(): Promise<Garden> {
  const c = await db();
  const [nodesRes, edgesRes, resRes] = await Promise.all([
    c.execute("SELECT * FROM nodes ORDER BY created_at ASC"),
    c.execute("SELECT * FROM edges"),
    c.execute("SELECT * FROM resources ORDER BY rank ASC"),
  ]);

  const resByNode = new Map<string, Resource[]>();
  for (const r of resRes.rows) {
    const nodeId = String(r.node_id);
    const arr = resByNode.get(nodeId) ?? [];
    arr.push({
      id: String(r.id),
      node_id: nodeId,
      url: String(r.url),
      title: String(r.title),
      type: r.type as Resource["type"],
      rank: Number(r.rank),
      user_provided: !!Number(r.user_provided),
    });
    resByNode.set(nodeId, arr);
  }

  const nodes: GraphNode[] = nodesRes.rows.map((n) => ({
    id: String(n.id),
    topic: String(n.topic),
    concept_summary: String(n.concept_summary),
    status: n.status as NodeStatus,
    x: Number(n.x),
    y: Number(n.y),
    created_at: Number(n.created_at),
    last_verified_at: n.last_verified_at == null ? null : Number(n.last_verified_at),
    resources: resByNode.get(String(n.id)) ?? [],
  }));

  const edges: GraphEdge[] = edgesRes.rows.map((e) => ({
    id: String(e.id),
    from_node_id: String(e.from_node_id),
    to_node_id: String(e.to_node_id),
  }));

  return { nodes, edges };
}

// ---------- Generate a graph from a goal ----------

interface GeneratedNode {
  key: string;
  topic: string;
  concept_summary: string;
  prerequisites: string[]; // keys of other generated nodes
  resources: { title: string; url: string; type: string }[];
}

const GRAPH_SYSTEM = `You are Noesis's graph gardener. You turn a learning goal into a SMALL dependency graph of concepts.

Rules:
- Return 3 to 6 nodes MAX. Never a huge tree — the graph grows later as the learner progresses.
- Order matters: earlier concepts are prerequisites of later ones. The final node should be the goal itself.
- Each node: a short "topic" (2-5 words), a one-sentence "concept_summary", a list of prerequisite node keys (by their "key"), and 1-3 real, well-known resources.
- Resources must be plausible real URLs (official docs, well-known YouTube channels, canonical articles). Mark type as "video", "doc", or "article".
- If the learner provides their own source, treat it as the SPINE of the graph: build nodes that follow that source's structure, then add prerequisite nodes only where a beginner would be missing something. Attach the provided source (user_provided) to the most relevant node(s).
- Keep it honest and beginner-aware. Do not invent nodes just to look thorough.

Return STRICT JSON only, no prose, shaped exactly as:
{"nodes":[{"key":"snake_case_id","topic":"...","concept_summary":"...","prerequisites":["other_key"],"resources":[{"title":"...","url":"https://...","type":"video|doc|article"}]}]}`;

export async function generateGraph(
  goal: string,
  sourceUrl?: string,
  source?: { name: string; text: string }
) {
  const userParts = [`Learning goal: "${goal.trim()}"`];
  if (sourceUrl?.trim()) {
    userParts.push(
      `The learner wants to learn from THIS specific source (use it as the spine, fill only real gaps): ${sourceUrl.trim()}`
    );
  }
  if (source?.text?.trim()) {
    userParts.push(
      `The learner uploaded a source titled "${source.name}". Use its CONTENT below as the spine of the graph — build nodes that follow its structure, and add prerequisite nodes only where a beginner would be missing something.\n\n--- SOURCE CONTENT (may be truncated) ---\n${source.text.trim()}\n--- END SOURCE ---`
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: GRAPH_SYSTEM },
    { role: "user", content: userParts.join("\n") },
  ];

  const { text, provider } = await generate({ messages, json: true, temperature: 0.6 });
  const parsed = parseJsonObject<{ nodes: GeneratedNode[] }>(text);
  const generated = (parsed.nodes ?? []).slice(0, 6);
  if (generated.length === 0) throw new Error("The gardener returned an empty graph");

  const pinnedTitle = source?.name || (sourceUrl ? "Your source" : undefined);
  const pinnedUrl = sourceUrl?.trim() || (source ? `uploaded:${source.name}` : undefined);
  const saved = await persistGeneratedGraph(generated, pinnedUrl, pinnedTitle);
  return { ...saved, provider };
}

async function persistGeneratedGraph(
  generated: GeneratedNode[],
  pinnedUrl?: string,
  pinnedTitle?: string
): Promise<Garden> {
  const c = await db();
  const now = Date.now();

  // Lay the new cluster out organically (not on a grid): a loose vine from
  // top-left toward bottom-right, jittered deterministically by index.
  const existing = await c.execute("SELECT COUNT(*) as n FROM nodes");
  const offset = Number(existing.rows[0]?.n ?? 0);

  const keyToId = new Map<string, string>();
  for (const g of generated) keyToId.set(g.key, newId("node"));

  for (let i = 0; i < generated.length; i++) {
    const g = generated[i];
    const id = keyToId.get(g.key)!;
    // Organic scatter: a gentle diagonal drift with sine jitter.
    const t = i + offset * 0.6;
    const x = 160 + t * 210 + Math.sin(t * 1.7) * 70;
    const y = 200 + Math.cos(t * 0.9) * 150 + (i % 2) * 90;

    await c.execute({
      sql: `INSERT INTO nodes (id, topic, concept_summary, status, x, y, created_at, last_verified_at)
            VALUES (?, ?, ?, 'seed', ?, ?, ?, NULL)`,
      args: [id, g.topic, g.concept_summary ?? "", x, y, now + i],
    });

    const resources = (g.resources ?? []).slice(0, 3);
    for (let r = 0; r < resources.length; r++) {
      const res = resources[r];
      await c.execute({
        sql: `INSERT INTO resources (id, node_id, url, title, type, rank, user_provided)
              VALUES (?, ?, ?, ?, ?, ?, 0)`,
        args: [
          newId("res"),
          id,
          res.url ?? "",
          res.title ?? res.url ?? "Resource",
          normalizeType(res.type),
          r + 1,
        ],
      });
    }

    // Pin the learner's own source to the goal node (last generated) as rank 0.
    if (pinnedUrl?.trim() && i === generated.length - 1) {
      await c.execute({
        sql: `INSERT INTO resources (id, node_id, url, title, type, rank, user_provided)
              VALUES (?, ?, ?, ?, ?, 0, 1)`,
        args: [newId("res"), id, pinnedUrl.trim(), pinnedTitle || "Your source", "article"],
      });
    }
  }

  for (const g of generated) {
    const toId = keyToId.get(g.key)!;
    for (const pre of g.prerequisites ?? []) {
      const fromId = keyToId.get(pre);
      if (!fromId) continue;
      await c.execute({
        sql: `INSERT INTO edges (id, from_node_id, to_node_id) VALUES (?, ?, ?)`,
        args: [newId("edge"), fromId, toId],
      });
    }
  }

  return loadGarden();
}

function normalizeType(t?: string): string {
  const v = (t ?? "").toLowerCase();
  if (v.includes("video") || v.includes("youtube")) return "video";
  if (v.includes("doc")) return "doc";
  return "article";
}

// ---------- Nudges (spaced repetition) ----------

const STALE_MS = 21 * 24 * 60 * 60 * 1000; // three weeks

/** Bloomed nodes not verified in ~3 weeks — "wilting", due for a refresher. */
export async function wiltingNodes(now = Date.now()): Promise<GraphNode[]> {
  const garden = await loadGarden();
  return garden.nodes.filter(
    (n) => n.status === "bloom" && now - (n.last_verified_at ?? now) > STALE_MS
  );
}

// ---------- Conversation (node-aware) ----------

export async function getNode(nodeId: string): Promise<GraphNode | null> {
  const garden = await loadGarden();
  return garden.nodes.find((n) => n.id === nodeId) ?? null;
}

export async function companionReply(nodeId: string, history: Turn[], mode: string) {
  const node = await getNode(nodeId);
  if (!node) throw new Error("node not found");

  const garden = await loadGarden();
  const bloomed = garden.nodes
    .filter((n) => n.status === "bloom")
    .map((n) => n.topic)
    .slice(0, 20);

  const listenMode = mode === "listen";
  const system = `You are Noesis — a warm, curious learning companion the user "calls" to talk through a concept, like phoning a friend who happens to know everything. You are talking OUT LOUD; your words will be spoken by a voice.

The concept right now is: "${node.topic}".
Summary: ${node.concept_summary}
${bloomed.length ? `The learner has already proven they understand: ${bloomed.join(", ")}. Build on these; don't re-explain them.` : ""}

Style:
- Speak in short, natural spoken sentences. No markdown, no lists, no headings — this is a phone call.
- ${listenMode ? "This is 'explain to me' mode: give a clear, flowing spoken explanation with natural pauses, but keep it human, not a lecture." : "Keep YOUR turns short. Ask the learner to explain things back in their own words. Nudge gently when they're fuzzy. Let them lead and go on tangents."}
- Warm and plain, never twee. One clear idea per turn.
- If the learner says they've got it / that's enough, wrap up warmly in one sentence.`;

  const messages: ChatMessage[] = [{ role: "system", content: system }];
  if (history.length === 0) {
    messages.push({
      role: "user",
      content: listenMode
        ? "(the learner just tapped 'explain to me' — begin explaining)"
        : "(the call just connected — greet them briefly and invite them to start)",
    });
  } else {
    for (const t of history) {
      messages.push({ role: t.speaker === "user" ? "user" : "assistant", content: t.text });
    }
  }

  const { text, provider } = await generate({ messages, temperature: 0.8 });
  return { text: text.trim(), provider };
}

// ---------- Grading ----------

const GRADE_SYSTEM = `You grade whether a learner actually UNDERSTANDS a concept, based only on what THEY said in a conversation. Be fair but honest — a confident-sounding but factually wrong or vague explanation must NOT pass. Check for real correctness, not fluency or repetition of the tutor's words.

Return STRICT JSON only:
{"understood": boolean, "confidence": number 0..1, "gaps": [ "specific missing or wrong point", ... ], "follow_up_needed": boolean, "companion_note": "one warm, plain sentence to the learner about how it went"}

Guidance:
- understood=true only if the learner demonstrated the core idea correctly in their own words.
- If mostly right with one real gap, understood can be true but follow_up_needed=true and list the gap.
- If they mostly echoed the tutor or were vague/wrong, understood=false.`;

export async function gradeSession(
  nodeId: string,
  transcript: Turn[],
  mode: string
): Promise<{ result: CheckpointResult; garden: Garden; provider: string }> {
  const node = await getNode(nodeId);
  if (!node) throw new Error("node not found");

  const convo = transcript
    .map((t) => `${t.speaker === "user" ? "Learner" : "Companion"}: ${t.text}`)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: GRADE_SYSTEM },
    {
      role: "user",
      content: `Concept: "${node.topic}" — ${node.concept_summary}\n\nConversation:\n${convo}\n\nGrade the learner.`,
    },
  ];

  const { text, provider } = await generate({ messages, json: true, temperature: 0.2 });
  const raw = parseJsonObject<{
    understood: boolean;
    confidence: number;
    gaps: string[];
    follow_up_needed: boolean;
    companion_note: string;
  }>(text);

  const understood = !!raw.understood;
  const followUp = !!raw.follow_up_needed;
  // Passive-listen alone can't fully bloom a node: cap at sprout.
  let next_status: NodeStatus;
  if (!understood) next_status = "sprout";
  else if (followUp || mode === "listen") next_status = "sprout";
  else next_status = "bloom";

  const result: CheckpointResult = {
    understood,
    confidence: clamp01(Number(raw.confidence)),
    gaps: Array.isArray(raw.gaps) ? raw.gaps.slice(0, 5).map(String) : [],
    follow_up_needed: followUp,
    next_status,
    companion_note: String(raw.companion_note ?? "").trim() || defaultNote(next_status),
  };

  await persistCheckpoint(node.id, mode, transcript, result);
  const garden = await loadGarden();
  return { result, garden, provider };
}

async function persistCheckpoint(
  nodeId: string,
  mode: string,
  transcript: Turn[],
  result: CheckpointResult
) {
  const c = await db();
  const now = Date.now();
  const sessionId = newId("sess");

  await c.execute({
    sql: `INSERT INTO call_sessions (id, node_id, mode, started_at, ended_at, audio_ref)
          VALUES (?, ?, ?, ?, ?, NULL)`,
    args: [sessionId, nodeId, mode, now, now],
  });

  for (const t of transcript) {
    await c.execute({
      sql: `INSERT INTO transcripts (id, session_id, speaker, text, timestamp) VALUES (?, ?, ?, ?, ?)`,
      args: [newId("tr"), sessionId, t.speaker, t.text, now],
    });
  }

  await c.execute({
    sql: `INSERT INTO checkpoint_results (id, session_id, understood, confidence, gaps, follow_up_needed, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      newId("chk"),
      sessionId,
      result.understood ? 1 : 0,
      result.confidence,
      JSON.stringify(result.gaps),
      result.follow_up_needed ? 1 : 0,
      now,
    ],
  });

  const verifiedAt = result.next_status === "bloom" ? now : null;
  await c.execute({
    sql: `UPDATE nodes SET status = ?, last_verified_at = COALESCE(?, last_verified_at) WHERE id = ?`,
    args: [result.next_status, verifiedAt, nodeId],
  });
}

// ---------- Quick-explain node (Scenario A) ----------

export async function addQuickNode(topic: string): Promise<Garden> {
  const c = await db();
  const now = Date.now();
  const existing = await c.execute("SELECT COUNT(*) as n FROM nodes");
  const offset = Number(existing.rows[0]?.n ?? 0);
  const t = offset * 0.6;
  const x = 160 + t * 210 + Math.sin(t * 1.7) * 70;
  const y = 200 + Math.cos(t * 0.9) * 150;
  await c.execute({
    sql: `INSERT INTO nodes (id, topic, concept_summary, status, x, y, created_at, last_verified_at)
          VALUES (?, ?, ?, 'seed', ?, ?, ?, NULL)`,
    args: [newId("node"), topic.trim(), "A quick thing you were curious about.", x, y, now],
  });
  return loadGarden();
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function defaultNote(status: NodeStatus): string {
  if (status === "bloom") return "That's bloomed — you clearly get it.";
  return "Almost there. One more pass and this one will bloom.";
}
