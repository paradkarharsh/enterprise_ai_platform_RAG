"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Circle, ArrowRight, Maximize2, Filter, Loader2 } from "lucide-react";
import ReactFlow, { Background, Controls, MarkerType, useNodesState, useEdgesState, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useToastStore } from "@/lib/store";

const getEntityColor = (type: string) => {
  switch (type) {
    case "CONCEPT": return "var(--cobalt)";
    case "ORG": return "var(--cobalt-light)";
    case "DOC": return "var(--slate-400)";
    case "SYSTEM": return "var(--slate-300)";
    default: return "var(--cobalt)";
  }
};

const initialEntities = [
  { id: "1", name: "GPT-4 Architecture", type: "CONCEPT", connections: 12, color: "#2e5bff" },
  { id: "2", name: "Google DeepMind", type: "ORG", connections: 8, color: "#b8c3ff" },
  { id: "3", name: "Transformer Model", type: "CONCEPT", connections: 15, color: "#2e5bff" },
  { id: "4", name: "Q3 Revenue Report", type: "DOC", connections: 6, color: "#b7c8e1" },
  { id: "5", name: "Multi-Agent Systems", type: "CONCEPT", connections: 9, color: "#2e5bff" },
  { id: "6", name: "Microsoft Research", type: "ORG", connections: 7, color: "#b8c3ff" },
  { id: "7", name: "RAG Pipeline v2.3", type: "SYSTEM", connections: 11, color: "#bec6e0" },
  { id: "8", name: "2024-Q1 Benchmarks", type: "DOC", connections: 4, color: "#b7c8e1" },
];

const relationships = [
  { from: "GPT-4 Architecture", to: "Transformer Model", relation: "IMPLEMENTS" },
  { from: "Google DeepMind", to: "Multi-Agent Systems", relation: "RESEARCHES" },
  { from: "RAG Pipeline v2.3", to: "GPT-4 Architecture", relation: "UTILIZES" },
  { from: "Microsoft Research", to: "Transformer Model", relation: "DEVELOPS" },
];

export default function GraphPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeEntityTypes, setActiveEntityTypes] = useState<string[]>(["CONCEPT", "ORG", "DOC", "SYSTEM"]);
  const [showFilters, setShowFilters] = useState(false);
  const [entitiesList, setEntitiesList] = useState(initialEntities);
  const [relationshipsList, setRelationshipsList] = useState(relationships);
  const [isExploring, setIsExploring] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Generate ReactFlow layout
  const generateLayout = (entitiesToRender: typeof entitiesList, relsToRender: typeof relationshipsList) => {
    const center = { x: 300, y: 200 };
    const radius = 180;
    
    const newNodes: Node[] = entitiesToRender.map((ent, i) => {
      const angle = (i * 360) / Math.max(entitiesToRender.length, 1);
      const rad = (angle * Math.PI) / 180;
      
      return {
        id: ent.name,
        position: {
          x: center.x + radius * Math.cos(rad),
          y: center.y + radius * Math.sin(rad),
        },
        data: { label: ent.name },
        style: {
          background: "var(--bg-glass)",
          border: `1px solid ${getEntityColor(ent.type)}`,
          borderRadius: "8px",
          color: "var(--text-primary)",
          fontSize: "12px",
          fontFamily: "var(--font-headline)",
          padding: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }
      };
    });

    const newEdges: Edge[] = relsToRender.map((rel, i) => ({
      id: `e-${rel.from}-${rel.to}-${i}`,
      source: rel.from,
      target: rel.to,
      label: rel.relation,
      animated: true,
      style: { stroke: 'var(--cobalt)' },
      labelStyle: { fill: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: 'var(--bg-base)' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--cobalt)' },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const { addToast } = useToastStore();

  const handleExploreFullGraph = () => {
    if (isExploring) return;
    setIsExploring(true);
    addToast("Querying graph database for additional clusters...", "info");
    setTimeout(() => {
      setIsExploring(false);
      addToast("Successfully linked 4 new entities and 4 relationships", "success");
      
      const newEntities = [
        { id: "9", name: "LangGraph Agent", type: "SYSTEM", connections: 6, color: "#bec6e0" },
        { id: "10", name: "Neo4j Cypher Engine", type: "SYSTEM", connections: 4, color: "#bec6e0" },
        { id: "11", name: "Vector Index Store", type: "SYSTEM", connections: 5, color: "#bec6e0" },
        { id: "12", name: "Entity Extractor", type: "CONCEPT", connections: 3, color: "#2e5bff" },
      ];
      const newRels = [
        { from: "RAG Pipeline v2.3", to: "LangGraph Agent", relation: "ORCHESTRATES" },
        { from: "LangGraph Agent", to: "Neo4j Cypher Engine", relation: "QUERIES" },
        { from: "Neo4j Cypher Engine", to: "GPT-4 Architecture", relation: "ENRICHES" },
        { from: "Vector Index Store", to: "RAG Pipeline v2.3", relation: "BACKS" },
      ];
      
      setEntitiesList((prev) => {
        const existingNames = new Set(prev.map(e => e.name));
        const filteredNew = newEntities.filter(e => !existingNames.has(e.name));
        return [...prev, ...filteredNew];
      });
      setRelationshipsList((prev) => {
        const existingKey = new Set(prev.map(r => `${r.from}-${r.to}`));
        const filteredNew = newRels.filter(r => !existingKey.has(`${r.from}-${r.to}`));
        return [...prev, ...filteredNew];
      });
    }, 1500);
  };

  const toggleEntityType = (type: string) => {
    setActiveEntityTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const filteredEntities = entitiesList.filter(e => activeEntityTypes.includes(e.type));
  const filteredRelationships = relationshipsList.filter(r => {
    const entityNames = new Set(filteredEntities.map(e => e.name));
    return entityNames.has(r.from) && entityNames.has(r.to);
  });

  // Update layout when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    generateLayout(filteredEntities, filteredRelationships);
  }, [activeEntityTypes, entitiesList, relationshipsList]);

  return (
    <div style={{ background: "var(--bg-base)" }} className="py-8 px-6 lg:px-10 relative">
      <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="page-header mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, letterSpacing: "-0.02em" }}>
                Knowledge Graph
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: 6 }}>
                Explore entity relationships and knowledge topology
              </p>
            </div>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                <Filter size={14} /> Filters {activeEntityTypes.length < 4 && `(${activeEntityTypes.length})`}
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                <Maximize2 size={14} /> Fullscreen
              </button>

              {/* Filters Dropdown */}
              <AnimatePresence>
                {showFilters && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 10 }}
                      onClick={() => setShowFilters(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="card"
                      style={{
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        marginTop: 6,
                        zIndex: 20,
                        padding: 12,
                        minWidth: 160,
                        boxShadow: "var(--shadow-lg)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {["CONCEPT", "ORG", "DOC", "SYSTEM"].map((type) => {
                        const checked = activeEntityTypes.includes(type);
                        return (
                          <label
                            key={type}
                            className="flex items-center gap-2 cursor-pointer font-headline"
                            style={{ fontSize: "0.75rem", color: "var(--text-primary)" }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEntityType(type)}
                              style={{ accentColor: "var(--cobalt)" }}
                            />
                            {type}
                          </label>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* ── Graph Visualization Placeholder ── */}
          <div className="lg:col-span-2 glass-card" style={{ padding: 0, minHeight: 480, position: "relative", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", minHeight: 480 }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
              >
                <Background color="var(--slate-800)" gap={16} />
                <Controls style={{ background: "var(--bg-glass)", border: "1px solid var(--border-default)" }} />
              </ReactFlow>
            </div>
            {/* Graph stats overlay */}
            <div style={{
              position: "absolute", bottom: 16, left: 16, right: 16,
              display: "flex", gap: 12,
            }}>
              {[
                { label: "ENTITIES", value: (filteredEntities.length * 15).toLocaleString() },
                { label: "RELATIONS", value: (filteredRelationships.length * 25).toLocaleString() },
                { label: "CLUSTERS", value: "24" },
              ].map((stat, i) => (
                <div key={i} style={{
                  padding: "8px 14px", borderRadius: "var(--radius-sm)",
                  background: "var(--bg-elevated)", border: "1px solid var(--slate-800)",
                }}>
                  <p className="text-label" style={{ color: "var(--text-tertiary)", fontSize: 9, marginBottom: 2 }}>{stat.label}</p>
                  <p style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Entity List ── */}
          <div className="glass-card flex flex-col" style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--slate-800)" }}>
              <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem", color: "var(--text-primary)" }}>
                Extracted Entities
              </h3>
              <p className="text-label" style={{ color: "var(--text-tertiary)", marginTop: 4, fontSize: 10 }}>
                {filteredEntities.length} OF {entitiesList.length} ENTITIES DISCOVERED
              </p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "320px" }}>
              {filteredEntities.map((entity, i) => (
                <motion.div
                  key={entity.name}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="list-item flex items-center gap-3"
                >
                  <Circle size={8} fill={getEntityColor(entity.type)} style={{ color: getEntityColor(entity.type), flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p style={{
                      fontFamily: "var(--font-headline)", fontWeight: 500,
                      fontSize: "0.8125rem", color: "var(--text-primary)",
                    }} className="truncate">
                      {entity.name}
                    </p>
                    <p style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.625rem",
                      color: "var(--text-tertiary)", marginTop: 2,
                    }}>
                      {entity.connections} connections
                    </p>
                  </div>
                  <span className="badge" style={{ fontSize: "0.5625rem" }}>{entity.type}</span>
                </motion.div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--slate-800)" }}>
              <button
                onClick={handleExploreFullGraph}
                disabled={isExploring}
                className="btn-primary w-full"
                style={{ fontSize: "0.75rem" }}
              >
                {isExploring ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Querying Database...
                  </>
                ) : (
                  <>
                    <GitBranch size={14} /> Explore Full Graph
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Relationships ── */}
        <div className="glass-card mt-6" style={{ padding: "24px" }}>
          <h3 style={{ fontFamily: "var(--font-headline)", fontWeight: 500, fontSize: "0.9375rem", marginBottom: 16 }}>
            Recent Relationships
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredRelationships.map((rel, i) => (
              <motion.div
                key={`${rel.from}-${rel.to}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "16px 20px", borderRadius: "16px",
                  background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                }}
              >
                <span style={{ fontFamily: "var(--font-headline)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)", flex: 1 }} className="truncate">
                  {rel.from}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <ArrowRight size={12} style={{ color: "var(--cobalt)" }} />
                  <span className="badge badge-accent" style={{ fontSize: "0.5625rem" }}>{rel.relation}</span>
                  <ArrowRight size={12} style={{ color: "var(--cobalt)" }} />
                </div>
                <span style={{ fontFamily: "var(--font-headline)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)", flex: 1, textAlign: "right" }} className="truncate">
                  {rel.to}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fullscreen Graph Overlay ── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "var(--bg-base)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontFamily: "var(--font-headline)", fontWeight: 600 }}>Interactive Knowledge Graph</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>Fullscreen Topology Explorer</p>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                Close Fullscreen
              </button>
            </div>
            
            <div className="flex-1 glass-card overflow-hidden" style={{ minHeight: 0, position: "relative" }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
              >
                <Background color="var(--slate-800)" gap={16} />
                <Controls style={{ background: "var(--bg-glass)", border: "1px solid var(--border-default)" }} />
              </ReactFlow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
