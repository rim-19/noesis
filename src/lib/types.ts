// Shared domain types for Noesis's garden.

export type NodeStatus = "seed" | "sprout" | "bloom";
// seed   = not started
// sprout = learning in progress (you've begun the lesson)
// bloom  = understanding verified via a checkpoint

export type ResourceType = "video" | "doc" | "article";

export interface Resource {
  id: string;
  node_id: string;
  url: string;
  title: string;
  type: ResourceType;
  rank: number;
  user_provided: boolean;
}

export interface GraphNode {
  id: string;
  subject_id: string;
  topic: string;
  concept_summary: string;
  status: NodeStatus;
  depth: number;
  x: number;
  y: number;
  created_at: number;
  last_verified_at: number | null;
  resources: Resource[];
}

export interface GraphEdge {
  id: string;
  subject_id: string;
  from_node_id: string;
  to_node_id: string;
}

export interface Subject {
  id: string;
  title: string;
  goal: string;
  language: string; // "" = follow the learner's own language
  created_at: number;
}

export interface Garden {
  subjects: Subject[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// A message in a node's persistent teaching thread.
export interface Message {
  id: string;
  role: "user" | "tutor";
  content: string;
  created_at: number;
}

export type Turn = { speaker: "user" | "ai"; text: string };

// Output of a checkpoint (verification) step.
export interface CheckpointResult {
  understood: boolean;
  confidence: number;
  gaps: string[];
  follow_up_needed: boolean;
  next_status: NodeStatus;
  companion_note: string;
}
