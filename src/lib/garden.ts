// Repository + AI orchestration for the garden. Everything is scoped to a
// userId so gardens are private. Teaching-first: a node has a persistent lesson
// thread where the tutor actually teaches; verification is a separate step.

import "server-only";
import { db, newId } from "./db";
import { generate, parseJsonObject, type ChatMessage } from "./ai";
import type {
  Garden,
  GraphNode,
  GraphEdge,
  Subject,
  Resource,
  NodeStatus,
  Message,
  CheckpointResult,
} from "./types";

// ---------- Load ----------

export async function loadGarden(userId: string): Promise<Garden> {
  const c = await db();
  const [subjRes, nodesRes, edgesRes, resRes] = await Promise.all([
    c.execute({ sql: "SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at ASC", args: [userId] }),
    c.execute({ sql: "SELECT * FROM nodes WHERE user_id = ? ORDER BY created_at ASC", args: [userId] }),
    c.execute({ sql: "SELECT * FROM edges WHERE user_id = ?", args: [userId] }),
    c.execute({ sql: "SELECT * FROM resources WHERE user_id = ? ORDER BY rank ASC", args: [userId] }),
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

  const subjects: Subject[] = subjRes.rows.map((s) => ({
    id: String(s.id),
    title: String(s.title),
    goal: String(s.goal),
    language: String(s.language ?? ""),
    created_at: Number(s.created_at),
  }));

  const nodes: GraphNode[] = nodesRes.rows.map((n) => ({
    id: String(n.id),
    subject_id: String(n.subject_id),
    topic: String(n.topic),
    concept_summary: String(n.concept_summary),
    status: n.status as NodeStatus,
    depth: Number(n.depth),
    x: Number(n.x),
    y: Number(n.y),
    created_at: Number(n.created_at),
    last_verified_at: n.last_verified_at == null ? null : Number(n.last_verified_at),
    resources: resByNode.get(String(n.id)) ?? [],
  }));

  const edges: GraphEdge[] = edgesRes.rows.map((e) => ({
    id: String(e.id),
    subject_id: String(e.subject_id),
    from_node_id: String(e.from_node_id),
    to_node_id: String(e.to_node_id),
  }));

  return { subjects, nodes, edges };
}

export async function getNode(userId: string, nodeId: string): Promise<GraphNode | null> {
  const garden = await loadGarden(userId);
  return garden.nodes.find((n) => n.id === nodeId) ?? null;
}

// ---------- Generate a subject (cluster of nodes) from a goal ----------

interface GeneratedNode {
  key: string;
  topic: string;
  concept_summary: string;
  prerequisites: string[];
}

const GRAPH_SYSTEM = `You are Noesis's curriculum planner. Turn a learning goal into a DETAILED, well-organized dependency graph of concepts to LEARN — a real syllabus, start to finish.

Rules:
- Return 8 to 12 nodes — a thorough curriculum, not a sketch. Cover the subject comprehensively: foundations, core ideas, key sub-topics, nuances, and the advanced/culminating concepts. Leave no major gap between "knowing nothing" and "understanding it deeply".
- Order by dependency: each node lists the "key"s of concepts that must be understood first. Use real branching where a concept has multiple prerequisites — not just one long chain.
- Early nodes are foundations; later nodes build toward mastery of the whole subject.
- Each node: a specific "topic" (2-6 words) and a one-sentence "concept_summary" of exactly what is taught there. Make topics concrete and distinct, not vague.
- Sequence it like an expert teacher designing a complete course.
- You handle ANY field seriously and academically — science, art, history, philosophy, literature, crafts, culture, and mature or sensitive intellectual subjects (e.g. themes in philosophy, psychology, or art history). Treat every subject with scholarly depth and respect; never refuse a legitimate topic.

Return STRICT JSON only:
{"subject_title":"clear title for this whole subject","nodes":[{"key":"snake_case_id","topic":"...","concept_summary":"...","prerequisites":["other_key"]}]}`;

const SURPRISE_SYSTEM = `You are Noesis's curriculum planner. The learner is curious but doesn't know what to study, so YOU choose a genuinely interesting subject for them — from ANY field (science, history, art, philosophy, music, nature, engineering, language, culture, a niche craft or phenomenon — anything). Pick something specific and fascinating, not generic. Vary widely; surprise them.

Then build a DETAILED, well-organized dependency graph of 8 to 12 concepts to learn it start to finish, exactly per these rules:
- Order by dependency; each node lists prerequisite "key"s. Use real branching, not one long chain.
- Foundations first, building toward deep mastery; concrete, distinct topics with a one-sentence summary each.
- Design it like a complete course an expert would teach.

Return STRICT JSON only:
{"subject_title":"the subject you chose","nodes":[{"key":"snake_case_id","topic":"...","concept_summary":"...","prerequisites":["other_key"]}]}`;

export async function generateSubject(
  userId: string,
  goal: string,
  opts?: { sourceUrl?: string; source?: { name: string; text: string }; surprise?: boolean; seed?: string; language?: string }
): Promise<{ garden: Garden; subjectId: string; provider: string }> {
  const { sourceUrl, source, surprise, seed } = opts ?? {};
  const language = (opts?.language ?? "").trim();
  const langLine = language ? `\n\nWrite EVERYTHING (the subject title, every topic, and every summary) in ${language}.` : "";
  let messages: ChatMessage[];

  if (surprise) {
    messages = [
      { role: "system", content: SURPRISE_SYSTEM },
      { role: "user", content: `Choose a surprising subject and build its curriculum. Randomizer (use it to pick something different): ${seed ?? "x"}. Do not pick anything obvious or repeat common defaults.${langLine}` },
    ];
  } else {
    const parts = [`Learning goal: "${goal.trim()}"`];
    if (sourceUrl?.trim()) {
      parts.push(`Shape the path around this source the learner chose (fill only genuine gaps): ${sourceUrl.trim()}`);
    }
    if (source?.text?.trim()) {
      parts.push(
        `The learner uploaded "${source.name}". Use its structure as the backbone; add prerequisite nodes only where a beginner would be missing something.\n\n--- SOURCE (may be truncated) ---\n${source.text.trim()}\n--- END ---`
      );
    }
    messages = [
      { role: "system", content: GRAPH_SYSTEM },
      { role: "user", content: parts.join("\n") + langLine },
    ];
  }

  // Retry generation if the model returns unparseable JSON (common with
  // non-Latin content on free models).
  let generated: GeneratedNode[] = [];
  let parsedTitle = "";
  let provider = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await generate({ messages, json: true, temperature: surprise ? 0.85 : 0.5, maxTokens: 2200 });
      provider = r.provider;
      const parsed = parseJsonObject<{ subject_title?: string; nodes: GeneratedNode[] }>(r.text);
      const g = (parsed.nodes ?? []).slice(0, 12);
      if (g.length > 0) {
        generated = g;
        parsedTitle = parsed.subject_title?.trim() ?? "";
        break;
      }
    } catch (err) {
      console.warn(`[garden] generation attempt ${attempt + 1} failed to parse:`, (err as Error).message);
    }
  }
  if (generated.length === 0) throw new Error("The planner returned an empty or invalid path");

  const title = parsedTitle || goal.trim() || "A surprise subject";
  const subjectId = await persistSubject(userId, title, goal.trim() || title, language, generated, sourceUrl, source);
  await relayout(userId);
  return { garden: await loadGarden(userId), subjectId, provider };
}

async function persistSubject(
  userId: string,
  title: string,
  goal: string,
  language: string,
  generated: GeneratedNode[],
  sourceUrl?: string,
  source?: { name: string; text: string }
): Promise<string> {
  const c = await db();
  const now = Date.now();
  const subjectId = newId("subj");

  await c.execute({
    sql: `INSERT INTO subjects (id, user_id, title, goal, language, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [subjectId, userId, title, goal, language, now],
  });

  const keyToId = new Map<string, string>();
  for (const g of generated) keyToId.set(g.key, newId("node"));

  for (let i = 0; i < generated.length; i++) {
    const g = generated[i];
    const id = keyToId.get(g.key)!;
    await c.execute({
      sql: `INSERT INTO nodes (id, user_id, subject_id, topic, concept_summary, status, depth, x, y, created_at, last_verified_at)
            VALUES (?, ?, ?, ?, ?, 'seed', 0, 0, 0, ?, NULL)`,
      args: [id, userId, subjectId, g.topic, g.concept_summary ?? "", now + i],
    });

    // Real, never-dead resources: search links built from the topic.
    for (const res of searchResources(g.topic)) {
      await c.execute({
        sql: `INSERT INTO resources (id, user_id, node_id, url, title, type, rank, user_provided)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        args: [newId("res"), userId, id, res.url, res.title, res.type, res.rank],
      });
    }

    // Pin the learner's own source to the goal node.
    if (i === generated.length - 1 && (sourceUrl?.trim() || source)) {
      const url = sourceUrl?.trim() || `uploaded:${source?.name}`;
      const title2 = source?.name || "Your source";
      await c.execute({
        sql: `INSERT INTO resources (id, user_id, node_id, url, title, type, rank, user_provided)
              VALUES (?, ?, ?, ?, ?, 'article', 0, 1)`,
        args: [newId("res"), userId, id, url, title2],
      });
    }
  }

  for (const g of generated) {
    const toId = keyToId.get(g.key)!;
    for (const pre of g.prerequisites ?? []) {
      const fromId = keyToId.get(pre);
      if (!fromId) continue;
      await c.execute({
        sql: `INSERT INTO edges (id, user_id, subject_id, from_node_id, to_node_id) VALUES (?, ?, ?, ?, ?)`,
        args: [newId("edge"), userId, subjectId, fromId, toId],
      });
    }
  }

  return subjectId;
}

function searchResources(topic: string): { url: string; title: string; type: Resource["type"]; rank: number }[] {
  const q = encodeURIComponent(topic);
  return [
    { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " tutorial")}`, title: `Watch: ${topic}`, type: "video", rank: 1 },
    { url: `https://www.google.com/search?q=${encodeURIComponent(topic + " explained")}`, title: `Read about ${topic}`, type: "article", rank: 2 },
    { url: `https://en.wikipedia.org/w/index.php?search=${q}`, title: `Reference: ${topic}`, type: "doc", rank: 3 },
  ];
}

// ---------- Layout: layered per subject, subjects stacked in lanes ----------

const COL_W = 250;
const ROW_H = 140;
const LANE_GAP = 130;
const MARGIN_X = 140;
const MARGIN_Y = 120;

export async function relayout(userId: string): Promise<void> {
  const c = await db();
  const garden = await loadGarden(userId);

  let laneTop = MARGIN_Y;
  const updates: { id: string; x: number; y: number; depth: number }[] = [];

  for (const subject of garden.subjects) {
    const nodes = garden.nodes.filter((n) => n.subject_id === subject.id);
    if (nodes.length === 0) continue;
    const edges = garden.edges.filter((e) => e.subject_id === subject.id);

    // Longest-path depth (prerequisite chain length).
    const depth = new Map<string, number>();
    for (const n of nodes) depth.set(n.id, 0);
    for (let iter = 0; iter < nodes.length; iter++) {
      let changed = false;
      for (const e of edges) {
        const d = Math.max(depth.get(e.to_node_id) ?? 0, (depth.get(e.from_node_id) ?? 0) + 1);
        if (d !== depth.get(e.to_node_id)) {
          depth.set(e.to_node_id, d);
          changed = true;
        }
      }
      if (!changed) break;
    }

    // Group by depth, assign a row within each column.
    const byDepth = new Map<number, GraphNode[]>();
    for (const n of nodes) {
      const d = depth.get(n.id) ?? 0;
      const arr = byDepth.get(d) ?? [];
      arr.push(n);
      byDepth.set(d, arr);
    }
    let maxRows = 1;
    for (const [, arr] of byDepth) maxRows = Math.max(maxRows, arr.length);
    const laneHeight = maxRows * ROW_H;

    for (const [d, arr] of byDepth) {
      arr.sort((a, b) => a.created_at - b.created_at);
      const colOffset = (laneHeight - arr.length * ROW_H) / 2; // center the column
      arr.forEach((n, row) => {
        updates.push({
          id: n.id,
          x: MARGIN_X + d * COL_W,
          y: laneTop + colOffset + row * ROW_H,
          depth: d,
        });
      });
    }

    laneTop += laneHeight + LANE_GAP;
  }

  for (const u of updates) {
    await c.execute({ sql: `UPDATE nodes SET x = ?, y = ?, depth = ? WHERE id = ? AND user_id = ?`, args: [u.x, u.y, u.depth, u.id, userId] });
  }
}

// ---------- Teaching (the lesson thread) ----------

export async function lessonHistory(userId: string, nodeId: string): Promise<Message[]> {
  const c = await db();
  const res = await c.execute({
    sql: `SELECT id, role, content, created_at FROM messages WHERE user_id = ? AND node_id = ? ORDER BY created_at ASC`,
    args: [userId, nodeId],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    role: r.role as "user" | "tutor",
    content: String(r.content),
    created_at: Number(r.created_at),
  }));
}

function tutorSystem(node: GraphNode, subjectTitle: string, bloomed: string[], voice: boolean, language: string): string {
  const langRule = language
    ? `\n\nIMPORTANT: Teach entirely in ${language}. Every reply must be written in ${language}.`
    : `\n\nReply in the SAME language the learner writes in. If they write in Arabic, answer in Arabic; if French, answer in French, and so on.`;
  return `You are Noesis, an expert, patient tutor. You are teaching ONE concept, in depth, one-to-one. Your job is to TEACH — to make the learner genuinely understand — not to quiz them.

Subject: "${subjectTitle}".
Concept you are teaching now: "${node.topic}".
What this concept covers: ${node.concept_summary}
${bloomed.length ? `The learner has already mastered: ${bloomed.join(", ")}. Build on these and connect to them; don't re-teach them.` : ""}

How to teach:
- Teach in focused, digestible steps — ONE idea or section at a time, not the entire topic in a single message. This is a conversation, so cover a piece well, then invite them to continue ("ready for the next part?" / "want an example?").
- For your FIRST message: give a short, engaging introduction — the intuition and why this concept matters — and the very first building block. Do NOT dump the whole lesson at once.
- Explain from first principles. Start with intuition, then mechanics. Use concrete examples and analogies — show, don't just state.
- Be accurate above all. If something is genuinely uncertain or debated, say so. Never invent facts.
- End most turns by inviting the learner to continue or ask — but do NOT quiz them. They can ask you anything and you answer directly and fully.
${
  voice
    ? "- This will be spoken ALOUD. Use natural spoken language, shorter sentences, NO markdown, no bullet symbols, no headings, no code blocks. Keep each turn conversational — a paragraph or two — and pause to let them respond."
    : "- This is a text chat. You MAY use light markdown: short paragraphs, the occasional bullet list or **bold** for key terms, and fenced code blocks when relevant. Be thorough but well-structured."
}${langRule}`;
}

async function bloomedTopics(userId: string): Promise<string[]> {
  const garden = await loadGarden(userId);
  return garden.nodes.filter((n) => n.status === "bloom").map((n) => n.topic).slice(0, 20);
}

/**
 * Add the learner's message (if any) and produce the tutor's next teaching turn.
 * If there's no message and no history, the tutor opens the lesson by teaching.
 */
export async function lessonReply(
  userId: string,
  nodeId: string,
  userText: string,
  voice: boolean
): Promise<{ message: Message; provider: string }> {
  const node = await getNode(userId, nodeId);
  if (!node) throw new Error("node not found");
  const garden = await loadGarden(userId);
  const subject = garden.subjects.find((s) => s.id === node.subject_id);
  const bloomed = garden.nodes.filter((n) => n.status === "bloom" && n.id !== nodeId).map((n) => n.topic).slice(0, 20);

  const c = await db();
  const now = Date.now();

  if (userText.trim()) {
    await c.execute({
      sql: `INSERT INTO messages (id, user_id, node_id, role, content, created_at) VALUES (?, ?, ?, 'user', ?, ?)`,
      args: [newId("msg"), userId, nodeId, userText.trim(), now],
    });
  }

  const history = await lessonHistory(userId, nodeId);
  const messages: ChatMessage[] = [
    { role: "system", content: tutorSystem(node, subject?.title ?? node.topic, bloomed, voice, subject?.language ?? "") },
  ];
  if (history.length === 0) {
    messages.push({
      role: "user",
      content: "Start teaching me this concept from the beginning. Give me a clear, engaging first lesson.",
    });
  } else {
    for (const m of history) {
      messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
    }
  }

  const { text, provider } = await generate({
    messages,
    temperature: 0.6,
    maxTokens: voice ? 1000 : 1800,
  });
  const content = text.trim();

  const msgId = newId("msg");
  const created = Date.now();
  await c.execute({
    sql: `INSERT INTO messages (id, user_id, node_id, role, content, created_at) VALUES (?, ?, ?, 'tutor', ?, ?)`,
    args: [msgId, userId, nodeId, content, created],
  });

  // Starting a lesson moves a seed to sprout (learning in progress).
  if (node.status === "seed") {
    await c.execute({ sql: `UPDATE nodes SET status = 'sprout' WHERE id = ? AND user_id = ?`, args: [nodeId, userId] });
  }

  return { message: { id: msgId, role: "tutor", content, created_at: created }, provider };
}

// ---------- Verification (checkpoint) ----------

const GRADE_SYSTEM = `You are a fair examiner checking whether a learner UNDERSTANDS a concept, based only on what THEY said. Reward real, correct understanding in their own words; do NOT reward fluency, confidence, or repeating the tutor. A confident but wrong or vague answer must fail.

Return STRICT JSON only:
{"understood": boolean, "confidence": number 0..1, "gaps": ["specific missing or wrong point"], "follow_up_needed": boolean, "companion_note": "one warm, plain sentence to the learner about how it went"}`;

export async function gradeCheckpoint(
  userId: string,
  nodeId: string,
  transcript: { speaker: "user" | "ai"; text: string }[]
): Promise<{ result: CheckpointResult; garden: Garden; provider: string }> {
  const node = await getNode(userId, nodeId);
  if (!node) throw new Error("node not found");

  const convo = transcript.map((t) => `${t.speaker === "user" ? "Learner" : "Examiner"}: ${t.text}`).join("\n");
  const messages: ChatMessage[] = [
    { role: "system", content: GRADE_SYSTEM },
    { role: "user", content: `Concept: "${node.topic}" — ${node.concept_summary}\n\nWhat the learner said:\n${convo}\n\nGrade them.` },
  ];

  // Room for reasoning models (e.g. gpt-oss) to think AND still emit the JSON.
  const { text, provider } = await generate({ messages, json: true, temperature: 0.2, maxTokens: 1500 });
  const raw = parseJsonObject<{
    understood: boolean;
    confidence: number;
    gaps: string[];
    follow_up_needed: boolean;
    companion_note: string;
  }>(text);

  const understood = !!raw.understood;
  const followUp = !!raw.follow_up_needed;
  const next_status: NodeStatus = understood && !followUp ? "bloom" : "sprout";

  const result: CheckpointResult = {
    understood,
    confidence: clamp01(Number(raw.confidence)),
    gaps: Array.isArray(raw.gaps) ? raw.gaps.slice(0, 5).map(String) : [],
    follow_up_needed: followUp,
    next_status,
    companion_note:
      String(raw.companion_note ?? "").trim() ||
      (next_status === "bloom" ? "That's bloomed — you clearly get it." : "Almost — a little more and this will bloom."),
  };

  const c = await db();
  const now = Date.now();
  await c.execute({
    sql: `INSERT INTO checkpoint_results (id, user_id, node_id, understood, confidence, gaps, follow_up_needed, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [newId("chk"), userId, nodeId, understood ? 1 : 0, result.confidence, JSON.stringify(result.gaps), followUp ? 1 : 0, now],
  });
  const verifiedAt = next_status === "bloom" ? now : null;
  await c.execute({
    sql: `UPDATE nodes SET status = ?, last_verified_at = COALESCE(?, last_verified_at) WHERE id = ? AND user_id = ?`,
    args: [next_status, verifiedAt, nodeId, userId],
  });

  return { result, garden: await loadGarden(userId), provider };
}

// ---------- Management ----------

export async function deleteNode(userId: string, nodeId: string): Promise<Garden> {
  const c = await db();
  await c.execute({ sql: `DELETE FROM edges WHERE user_id = ? AND (from_node_id = ? OR to_node_id = ?)`, args: [userId, nodeId, nodeId] });
  await c.execute({ sql: `DELETE FROM resources WHERE user_id = ? AND node_id = ?`, args: [userId, nodeId] });
  await c.execute({ sql: `DELETE FROM messages WHERE user_id = ? AND node_id = ?`, args: [userId, nodeId] });
  await c.execute({ sql: `DELETE FROM nodes WHERE user_id = ? AND id = ?`, args: [userId, nodeId] });
  await relayout(userId);
  return loadGarden(userId);
}

export async function deleteSubject(userId: string, subjectId: string): Promise<Garden> {
  const c = await db();
  const nodeRows = await c.execute({ sql: `SELECT id FROM nodes WHERE user_id = ? AND subject_id = ?`, args: [userId, subjectId] });
  const nodeIds = nodeRows.rows.map((r) => String(r.id));
  for (const id of nodeIds) {
    await c.execute({ sql: `DELETE FROM resources WHERE user_id = ? AND node_id = ?`, args: [userId, id] });
    await c.execute({ sql: `DELETE FROM messages WHERE user_id = ? AND node_id = ?`, args: [userId, id] });
  }
  await c.execute({ sql: `DELETE FROM edges WHERE user_id = ? AND subject_id = ?`, args: [userId, subjectId] });
  await c.execute({ sql: `DELETE FROM nodes WHERE user_id = ? AND subject_id = ?`, args: [userId, subjectId] });
  await c.execute({ sql: `DELETE FROM subjects WHERE user_id = ? AND id = ?`, args: [userId, subjectId] });
  await relayout(userId);
  return loadGarden(userId);
}

export async function renameNode(userId: string, nodeId: string, topic: string): Promise<Garden> {
  const c = await db();
  await c.execute({ sql: `UPDATE nodes SET topic = ? WHERE user_id = ? AND id = ?`, args: [topic.trim().slice(0, 80), userId, nodeId] });
  return loadGarden(userId);
}

export async function resetGarden(userId: string): Promise<Garden> {
  const c = await db();
  for (const t of ["messages", "checkpoint_results", "resources", "edges", "nodes", "subjects"]) {
    await c.execute({ sql: `DELETE FROM ${t} WHERE user_id = ?`, args: [userId] });
  }
  return loadGarden(userId);
}

// ---------- Nudges ----------

const STALE_MS = 21 * 24 * 60 * 60 * 1000;

export async function wiltingNodes(userId: string, now = Date.now()): Promise<GraphNode[]> {
  const garden = await loadGarden(userId);
  return garden.nodes.filter((n) => n.status === "bloom" && now - (n.last_verified_at ?? now) > STALE_MS);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
