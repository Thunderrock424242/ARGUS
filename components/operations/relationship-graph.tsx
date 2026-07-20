import { useMemo, useState } from "react";
import { Filter, Search, ZoomIn, ZoomOut } from "lucide-react";
import { StatusBadge, titleCase } from "@/components/domain/argus-ui";
import type {
  AnalystRelationshipState,
  GraphNodeType,
  IntelligenceGraphNode,
  IntelligenceRelationship,
} from "@/packages/shared/types";

const nodeColumns: Record<GraphNodeType, number> = {
  event: 100,
  entity: 330,
  location: 330,
  country: 330,
  region: 330,
  infrastructure: 360,
  "supply-chain": 590,
  industry: 610,
  company: 610,
  stock: 870,
  etf: 870,
  index: 870,
  commodity: 870,
  currency: 870,
  cryptocurrency: 870,
};

const nodeTone: Record<GraphNodeType, string> = {
  event: "#67e8f9",
  entity: "#c4b5fd",
  location: "#94a3b8",
  country: "#93c5fd",
  region: "#60a5fa",
  industry: "#fbbf24",
  company: "#f0abfc",
  infrastructure: "#fb923c",
  stock: "#34d399",
  etf: "#4ade80",
  index: "#22c55e",
  commodity: "#facc15",
  currency: "#a3e635",
  cryptocurrency: "#2dd4bf",
  "supply-chain": "#f59e0b",
};

function edgeStyle(relationship: IntelligenceRelationship): { stroke: string; dash?: string; width: number } {
  if (relationship.analystState === "rejected") return { stroke: "#64748b", dash: "2 7", width: 1.2 };
  if (relationship.analystState === "disputed" || relationship.relationshipType === "disputed") return { stroke: "#f87171", dash: "7 5", width: 1.8 };
  if (relationship.relationshipType === "confirmed-impact") return { stroke: "#34d399", width: 2.8 };
  if (relationship.relationshipType === "correlated-movement") return { stroke: "#c084fc", dash: "4 4", width: 2 };
  if (relationship.relationshipType === "exposure-only") return { stroke: "#94a3b8", dash: "1 5", width: 1.6 };
  if (relationship.analystState === "needs-review" || relationship.relationshipType === "hypothesized-consequence") return { stroke: "#fbbf24", dash: "8 4", width: 2 };
  return { stroke: "#67e8f9", width: 2 };
}

interface PositionedNode extends IntelligenceGraphNode {
  x: number;
  y: number;
}

export function RelationshipGraph({
  nodes,
  relationships,
  initialRelationshipId,
}: {
  nodes: IntelligenceGraphNode[];
  relationships: IntelligenceRelationship[];
  initialRelationshipId?: string;
}) {
  const [query, setQuery] = useState("");
  const [threshold, setThreshold] = useState(45);
  const [analystState, setAnalystState] = useState<AnalystRelationshipState | "all">("all");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(initialRelationshipId ?? relationships[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [zoom, setZoom] = useState(1);

  const visibleRelationships = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-US");
    return relationships.filter((relationship) => {
      if (relationship.relationshipConfidence < threshold) return false;
      if (analystState !== "all" && relationship.analystState !== analystState) return false;
      if (!term) return true;
      const source = nodes.find((node) => node.id === relationship.sourceNodeId);
      const target = nodes.find((node) => node.id === relationship.targetNodeId);
      return `${source?.label ?? ""} ${target?.label ?? ""} ${relationship.explanation} ${relationship.relationshipType}`
        .toLocaleLowerCase("en-US")
        .includes(term);
    });
  }, [analystState, nodes, query, relationships, threshold]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleRelationships.flatMap((relationship) => [relationship.sourceNodeId, relationship.targetNodeId])),
    [visibleRelationships],
  );
  const positionedNodes = useMemo(() => {
    const visible = nodes.filter((node) => visibleNodeIds.has(node.id));
    const groups = new Map<number, IntelligenceGraphNode[]>();
    for (const node of visible) {
      const column = nodeColumns[node.type];
      const group = groups.get(column) ?? [];
      group.push(node);
      groups.set(column, group);
    }
    return visible.map<PositionedNode>((node) => {
      const column = nodeColumns[node.type];
      const group = groups.get(column) ?? [node];
      const index = group.findIndex((candidate) => candidate.id === node.id);
      return { ...node, x: column, y: 62 + (index * 490) / Math.max(1, group.length - 1) };
    });
  }, [nodes, visibleNodeIds]);
  const positionedById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
  const selectedRelationship = relationships.find((relationship) => relationship.id === selectedRelationshipId);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#081018]">
      <header className="grid gap-3 border-b border-white/[.08] bg-[#0d1720] p-3 lg:grid-cols-[minmax(220px,1fr)_190px_170px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-600" size={14} />
          <span className="sr-only">Search relationship graph</span>
          <input className="h-10 w-full rounded-md border border-white/10 bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-300/40" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nodes or explanations" />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-[10px] text-slate-500">
          <Filter size={13} /><span>Confidence {threshold}%+</span>
          <input className="min-w-0 flex-1 accent-cyan-300" type="range" min="0" max="95" step="5" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
        </label>
        <label>
          <span className="sr-only">Analyst relationship state</span>
          <select className="h-10 w-full rounded-md border border-white/10 bg-[#0a1219] px-3 text-xs text-slate-300" value={analystState} onChange={(event) => setAnalystState(event.target.value as AnalystRelationshipState | "all")}>
            <option value="all">All review states</option>
            <option value="automated">Automated</option>
            <option value="needs-review">Needs review</option>
            <option value="confirmed">Confirmed</option>
            <option value="disputed">Disputed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <div className="flex items-center justify-end gap-1">
          <button type="button" className="icon-button" aria-label="Zoom graph out" onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))}><ZoomOut size={15} /></button>
          <span className="w-12 text-center font-mono text-[9px] text-slate-500">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-button" aria-label="Zoom graph in" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}><ZoomIn size={15} /></button>
        </div>
      </header>

      <div className="grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-[540px] overflow-auto border-b border-white/[.08] bg-[radial-gradient(circle_at_50%_45%,rgba(8,145,178,.08),transparent_50%),linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px] xl:border-b-0 xl:border-r">
          <svg className="h-full min-h-[600px] w-full min-w-[820px]" viewBox="0 0 980 620" role="img" aria-label={`Impact graph with ${positionedNodes.length} nodes and ${visibleRelationships.length} relationships`}>
            <defs><marker id="argus-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="context-stroke" /></marker></defs>
            <g transform={`translate(${(1 - zoom) * 490} ${(1 - zoom) * 310}) scale(${zoom})`}>
              {visibleRelationships.map((relationship) => {
                const source = positionedById.get(relationship.sourceNodeId);
                const target = positionedById.get(relationship.targetNodeId);
                if (!source || !target) return null;
                const style = edgeStyle(relationship);
                const selected = relationship.id === selectedRelationshipId;
                const midpointX = (source.x + target.x) / 2;
                const path = `M ${source.x + 58} ${source.y} C ${midpointX} ${source.y}, ${midpointX} ${target.y}, ${target.x - 58} ${target.y}`;
                return (
                  <g key={relationship.id}>
                    <path d={path} fill="none" stroke="transparent" strokeWidth="14" className="cursor-pointer" onClick={() => setSelectedRelationshipId(relationship.id)} />
                    <path d={path} fill="none" stroke={style.stroke} strokeWidth={selected ? style.width + 1.8 : style.width} strokeDasharray={style.dash} opacity={selected ? 1 : 0.68} markerEnd="url(#argus-arrow)" className="pointer-events-none" />
                    {selected ? <text x={midpointX} y={(source.y + target.y) / 2 - 7} textAnchor="middle" fill="#e2e8f0" fontSize="9" className="uppercase">{relationship.relationshipConfidence}% · {relationship.relationshipType}</text> : null}
                  </g>
                );
              })}
              {positionedNodes.map((node) => {
                const selected = node.id === selectedNodeId;
                return (
                  <g key={node.id} className="cursor-pointer" role="button" tabIndex={0} aria-label={`${node.type}: ${node.label}`} onClick={() => setSelectedNodeId(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedNodeId(node.id); }}>
                    <rect x={node.x - 60} y={node.y - 25} width="120" height="50" rx="8" fill={selected ? "#162b35" : "#0d1821"} stroke={nodeTone[node.type]} strokeWidth={selected ? 2.5 : 1.2} />
                    <circle cx={node.x - 47} cy={node.y - 11} r="3.5" fill={nodeTone[node.type]} />
                    <text x={node.x - 39} y={node.y - 8} fill="#94a3b8" fontSize="7.5" className="uppercase">{node.type}</text>
                    <text x={node.x} y={node.y + 8} textAnchor="middle" fill="#e2e8f0" fontSize="9.5">{node.label.length > 23 ? `${node.label.slice(0, 22)}…` : node.label}</text>
                  </g>
                );
              })}
            </g>
          </svg>
          {visibleRelationships.length === 0 ? <div className="absolute inset-0 flex items-center justify-center"><div className="rounded-lg border border-white/10 bg-[#0b141c] p-6 text-center"><p className="text-sm font-semibold text-slate-300">No relationships match</p><p className="mt-2 text-xs text-slate-600">Lower the confidence threshold or clear the search.</p></div></div> : null}
        </div>

        <aside className="bg-[#0b141c]" aria-live="polite">
          {selectedNode ? (
            <div className="p-5">
              <StatusBadge tone="cyan">{titleCase(selectedNode.type)}</StatusBadge>
              <h3 className="mt-4 text-lg font-semibold text-slate-100">{selectedNode.label}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{selectedNode.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{selectedNode.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div>
              {selectedNode.eventId ? <p className="mt-5 rounded border border-white/[.08] p-3 font-mono text-[9px] text-slate-500">Event ID · {selectedNode.eventId}</p> : null}
              <button type="button" className="mt-4 text-[10px] text-cyan-300" onClick={() => setSelectedNodeId("")}>Show selected relationship instead</button>
            </div>
          ) : selectedRelationship ? (
            <RelationshipEvidence relationship={selectedRelationship} nodes={nodes} />
          ) : (
            <div className="p-8 text-center text-sm text-slate-600">Select an edge to inspect its evidence and confidence.</div>
          )}
        </aside>
      </div>
      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.08] bg-[#0a1219] px-4 py-3 text-[9px] uppercase tracking-[.12em] text-slate-500">
        <span className="text-slate-300">Edge semantics</span><span>Solid = assessed</span><span>Dashed = hypothesis/disputed</span><span>Dotted = exposure only</span><span>Every edge retains independent confidence</span>
      </footer>
    </section>
  );
}

function RelationshipEvidence({ relationship, nodes }: { relationship: IntelligenceRelationship; nodes: IntelligenceGraphNode[] }) {
  const source = nodes.find((node) => node.id === relationship.sourceNodeId);
  const target = nodes.find((node) => node.id === relationship.targetNodeId);
  return (
    <div className="p-5">
      <div className="flex flex-wrap gap-2"><StatusBadge tone={relationship.analystState === "confirmed" ? "green" : relationship.analystState === "disputed" ? "red" : relationship.analystState === "rejected" ? "neutral" : "amber"}>{titleCase(relationship.analystState)}</StatusBadge><StatusBadge tone="cyan">{titleCase(relationship.relationshipType)}</StatusBadge></div>
      <div className="mt-5 rounded-lg border border-white/[.08] bg-white/[.02] p-4"><p className="text-[9px] uppercase tracking-[.14em] text-slate-600">Impact path</p><p className="mt-2 text-sm font-semibold text-slate-200">{source?.label ?? relationship.sourceNodeId}</p><p className="my-2 text-xs text-cyan-300" aria-hidden="true">↓</p><p className="text-sm font-semibold text-slate-200">{target?.label ?? relationship.targetNodeId}</p></div>
      <p className="mt-4 text-xs leading-5 text-slate-400">{relationship.explanation}</p>
      {relationship.analystState === "needs-review" ? <p className="mt-3 rounded border border-amber-300/15 bg-amber-300/[.04] p-3 text-[10px] font-semibold uppercase tracking-[.1em] text-amber-200">Hypothesis — analyst review required</p> : null}
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Score label="Relationship" value={relationship.relationshipConfidence} />
        <Score label="Exposure" value={relationship.exposureConfidence} />
        <Score label="Causal" value={relationship.causalConfidence} />
        <Score label="Market anomaly" value={relationship.marketAnomalyScore} />
      </dl>
      <div className="mt-5 grid gap-2 text-[10px] text-slate-500"><p><span className="text-slate-300">Evidence:</span> {relationship.supportingReportIds.length} supporting report(s)</p><p><span className="text-slate-300">Contradictions:</span> {relationship.contradictingReportIds.length}</p><p><span className="text-slate-300">Detected by:</span> {titleCase(relationship.detectionMethod)} · {relationship.modelVersion}</p><p><span className="text-slate-300">Recalculated:</span> {new Date(relationship.lastRecalculatedAt).toLocaleString()}</p></div>
    </div>
  );
}

function Score({ label, value }: { label: string; value?: number }) {
  return <div className="rounded-lg border border-white/[.07] p-3"><dt className="text-[8px] uppercase tracking-[.13em] text-slate-600">{label}</dt><dd className="mt-1 font-mono text-lg text-slate-200">{value === undefined ? "—" : `${value}%`}</dd></div>;
}
