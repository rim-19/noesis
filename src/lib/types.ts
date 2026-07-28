// Shared domain types for Noesis's garden.

export type NodeStatus = "seed" | "sprout" | "bloom";
// seed  = gray / unverified
// sprout = partial (in progress, one gap flagged, or passively listened)
// bloom = green / understanding proven

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
  topic: string;
  concept_summary: string;
  status: NodeStatus;
  x: number;
  y: number;
  created_at: number;
  last_verified_at: number | null;
  resources: Resource[];
}

export interface GraphEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
}

export interface Garden {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type EngagementMode = "call" | "listen" | "text";

export interface Turn {
  speaker: "user" | "ai";
  text: string;
}

// Output of the grading step (checkpoint_results).
export interface CheckpointResult {
  understood: boolean;
  confidence: number; // 0..1
  gaps: string[];
  follow_up_needed: boolean;
  // Derived status the node should take after this checkpoint.
  next_status: NodeStatus;
  // One warm, plain sentence the companion says about how it went.
  companion_note: string;
}
