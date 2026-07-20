import { useMemo, useState } from "react";
import { ArrowRight, GitBranch, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/navigation/link";
import { MetricCard, PageHeader, StatusBadge, titleCase } from "@/components/domain/argus-ui";
import { buildImpactChains } from "@/packages/intelligence/impact-engine";
import type {
  IntelligenceEvent,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  MarketAsset,
  MarketImpactAssessment,
  RelationshipHistoryEntry,
} from "@/packages/shared/types";
import { RelationshipGraph } from "./relationship-graph";

export function ImpactWorkspace({
  events,
  nodes,
  relationships,
  history,
  assets,
  assessments,
}: {
  events: IntelligenceEvent[];
  nodes: IntelligenceGraphNode[];
  relationships: IntelligenceRelationship[];
  history: RelationshipHistoryEntry[];
  assets: MarketAsset[];
  assessments: MarketImpactAssessment[];
}) {
  const eventNode = nodes.find((node) => node.type === "event" && relationships.some((relationship) => relationship.sourceNodeId === node.id && relationship.targetNodeId === "node-port-northstar"));
  const chains = useMemo(() => eventNode ? buildImpactChains(relationships, eventNode.id, 5) : [], [eventNode, relationships]);
  const [selectedChainId, setSelectedChainId] = useState(chains[0]?.id ?? "");
  const selectedChain = chains.find((chain) => chain.id === selectedChainId) ?? chains[0];
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const relationshipById = useMemo(() => new Map(relationships.map((relationship) => [relationship.id, relationship])), [relationships]);
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Impact intelligence / graph operations" title="Relationships & impact" description="Inspect evidence-linked event relationships, multi-step consequences, market exposure, anomaly scoring, causal-confidence limits, and per-edge recalculation history." actions={<><StatusBadge tone="amber">{relationships.filter((item) => item.analystState === "needs-review").length} hypotheses</StatusBadge><StatusBadge tone="violet">{assessments.filter((item) => item.marketAnomalyScore >= 70).length} anomalies</StatusBadge></>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Graph nodes" value={nodes.length} detail="Events, infrastructure, regions, and assets" /><MetricCard label="Relationships" value={relationships.length} detail={`${relationships.filter((item) => item.analystState === "confirmed").length} analyst-confirmed`} tone="cyan" /><MetricCard label="Impact chains" value={chains.length} detail="Every link scored independently" tone="amber" /><MetricCard label="Market assessments" value={assessments.length} detail="Causality scored separately" tone="cyan" /></section>
      <RelationshipGraph nodes={nodes} relationships={relationships} initialRelationshipId={selectedChain?.relationshipIds[0]} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1219]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-4 py-3"><div><p className="text-[9px] uppercase tracking-[.15em] text-amber-300/70">Multi-step analysis</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Impact chains</h2></div><select className="h-9 rounded border border-white/10 bg-[#0b141c] px-3 text-[10px] text-slate-400" value={selectedChain?.id ?? ""} onChange={(event) => setSelectedChainId(event.target.value)} aria-label="Select impact chain">{chains.map((chain, index) => <option key={chain.id} value={chain.id}>Chain {index + 1} · {chain.relationshipIds.length} links · {chain.minimumRelationshipConfidence}% floor</option>)}</select></header>
          {selectedChain ? <div className="p-4 sm:p-5"><div className="flex flex-col gap-2">{selectedChain.nodeIds.map((nodeId, index) => { const node = nodeById.get(nodeId); const relationship = index < selectedChain.relationshipIds.length ? relationshipById.get(selectedChain.relationshipIds[index]) : undefined; return <div key={nodeId}><div className="flex items-center gap-3 rounded-lg border border-white/[.08] bg-white/[.02] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[.06] font-mono text-[10px] text-cyan-200">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-[9px] uppercase tracking-[.12em] text-slate-600">{node ? titleCase(node.type) : "Unknown node"}</p><p className="mt-1 text-sm font-semibold text-slate-200">{node?.label ?? nodeId}</p></div>{relationship ? <div className="text-right"><p className="font-mono text-sm text-slate-200">{relationship.relationshipConfidence}%</p><p className="text-[8px] uppercase tracking-[.12em] text-slate-600">relationship</p></div> : null}</div>{relationship ? <div className="ml-7 flex items-center gap-3 py-2 text-[9px] text-slate-500"><ArrowRight size={13} className="rotate-90 text-amber-300" /><span>{titleCase(relationship.relationshipType)} · causal {relationship.causalConfidence ?? "—"}% · {relationship.analystState === "needs-review" ? "Hypothesis — review required" : titleCase(relationship.analystState)}</span></div> : null}</div>; })}</div><div className="mt-5 rounded-lg border border-amber-300/15 bg-amber-300/[.035] p-4"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-amber-200">Chain interpretation boundary</p><p className="mt-2 text-xs leading-5 text-slate-400">The chain confidence floor is {selectedChain.minimumRelationshipConfidence}%. ARGUS does not multiply, average, or transfer confidence across links. Each arrow preserves separate evidence, contradictions, detection method, causal confidence, and analyst state.</p></div></div> : <div className="p-10 text-center text-sm text-slate-600">No multi-step chain is visible at the current data snapshot.</div>}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1219]">
          <header className="border-b border-white/[.08] px-4 py-3"><p className="text-[9px] uppercase tracking-[.15em] text-violet-300/70">Market signal review</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Anomaly assessments</h2></header>
          <div className="divide-y divide-white/[.055]">{assessments.map((assessment) => { const asset = assetById.get(assessment.assetId); const sourceEvent = eventById.get(assessment.eventId); const positive = (assessment.percentChange ?? 0) >= 0; return <article key={assessment.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-slate-100">{asset?.symbol ?? assessment.assetId}</span><StatusBadge tone={assessment.analystState === "disputed" ? "red" : assessment.marketAnomalyScore >= 70 ? "amber" : "neutral"}>{assessment.marketAnomalyScore} anomaly</StatusBadge></div><p className="mt-1 text-[9px] text-slate-600">{asset?.name}</p></div><span className={`flex items-center gap-1 font-mono text-sm ${positive ? "text-emerald-300" : "text-red-300"}`}>{positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{assessment.percentChange?.toFixed(2)}%</span></div><p className="mt-3 text-[10px] leading-4 text-slate-500">{assessment.explanation}</p><dl className="mt-3 grid grid-cols-4 gap-2 text-center"><MiniScore label="Exposure" value={assessment.exposureConfidence} /><MiniScore label="Relation" value={assessment.relationshipConfidence} /><MiniScore label="Anomaly" value={assessment.marketAnomalyScore} /><MiniScore label="Causal" value={assessment.causalConfidence} /></dl>{sourceEvent ? <Link className="mt-3 inline-flex text-[10px] text-cyan-300" href={`/events/${sourceEvent.slug}`}>Open linked event <ArrowRight size={11} className="ml-1" /></Link> : null}</article>; })}</div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1219]"><header className="flex items-center gap-2 border-b border-white/[.08] px-4 py-3"><GitBranch size={14} className="text-cyan-300" /><div><p className="text-[9px] uppercase tracking-[.15em] text-slate-600">Auditability</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Recent relationship recalculations</h2></div></header><div className="overflow-x-auto"><table className="data-table w-full min-w-[880px] text-left"><thead><tr><th>Relationship</th><th>Time</th><th>Confidence</th><th>Causal</th><th>State</th><th>Evidence</th><th>Ruleset</th></tr></thead><tbody>{history.slice(-12).reverse().map((entry) => <tr key={entry.id}><td className="font-mono text-[9px] text-slate-500">{entry.relationshipId}</td><td className="text-[10px] text-slate-500">{new Date(entry.occurredAt).toLocaleString()}</td><td className="font-mono text-xs text-slate-300">{entry.relationshipConfidence}%</td><td className="font-mono text-xs text-slate-300">{entry.causalConfidence ?? "—"}%</td><td><StatusBadge tone={entry.analystState === "confirmed" ? "green" : entry.analystState === "disputed" ? "red" : "amber"}>{titleCase(entry.analystState)}</StatusBadge></td><td className="text-[10px] text-slate-500">{entry.supportingReportIds.length} support · {entry.contradictingReportIds.length} contradict</td><td className="font-mono text-[9px] text-slate-600">{entry.rulesetVersion}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return <div className="rounded border border-white/[.06] p-2"><dt className="text-[7px] uppercase tracking-[.1em] text-slate-600">{label}</dt><dd className="mt-1 font-mono text-[10px] text-slate-300">{value}%</dd></div>;
}
