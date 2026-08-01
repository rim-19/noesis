"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { GrowthNode } from "./GrowthNode";
import { GrowthEdge } from "./GrowthEdge";
import type { Garden, GraphNode } from "@/lib/types";

const nodeTypes: NodeTypes = { growth: GrowthNode };
const edgeTypes: EdgeTypes = { growth: GrowthEdge };

export function GardenCanvas({
  garden,
  selectedId,
  justBloomedId,
  onSelect,
}: {
  garden: Garden;
  selectedId: string | null;
  justBloomedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const statusById = useMemo(() => {
    const m = new Map<string, GraphNode["status"]>();
    for (const n of garden.nodes) m.set(n.id, n.status);
    return m;
  }, [garden.nodes]);

  const nodes: Node[] = useMemo(
    () =>
      garden.nodes.map((n) => ({
        id: n.id,
        type: "growth",
        position: { x: n.x, y: n.y },
        data: { topic: n.topic, status: n.status, justBloomed: n.id === justBloomedId },
        selected: n.id === selectedId,
        draggable: true,
      })),
    [garden.nodes, selectedId, justBloomedId]
  );

  const edges: Edge[] = useMemo(
    () =>
      garden.edges.map((e) => {
        const fromBloomed = statusById.get(e.from_node_id) === "bloom";
        return {
          id: e.id,
          source: e.from_node_id,
          target: e.to_node_id,
          type: "growth",
          data: { grown: fromBloomed },
        };
      }),
    [garden.edges, statusById]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.35, maxZoom: 1.1 }}
      minZoom={0.3}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      elementsSelectable
    >
      <Background variant={BackgroundVariant.Dots} gap={38} size={1.5} color="rgba(205,166,248,0.14)" />
    </ReactFlow>
  );
}
