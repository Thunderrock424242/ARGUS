import { useMemo, useState } from "react";
import { BookmarkPlus, Check, FilePlus2, GitMerge, Pin, RefreshCw, SearchCheck, X } from "lucide-react";
import { ConfidenceMeter, StatusBadge, titleCase } from "@/components/domain/argus-ui";
import type { AnalystRelationshipState, IntelligenceGraphNode, IntelligenceRelationship } from "@/packages/shared/types";
import { useAuth } from "@/components/auth/auth-provider";

type LocalReview = {
  state: AnalystRelationshipState;
  explanation: string;
  confidence: number;
  notes: string;
  action?: string;
};

export function ConsequenceReview({ nodes, relationships }: { nodes: IntelligenceGraphNode[]; relationships: IntelligenceRelationship[] }) {
  const candidates = useMemo(() => relationships.filter((relationship) => relationship.analystState === "needs-review" || relationship.analystState === "disputed"), [relationships]);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [reviews, setReviews] = useState<Record<string, LocalReview>>({});
  const [notice, setNotice] = useState("Review a proposed downstream effect. Local demonstration decisions are non-durable.");
  const [submitting, setSubmitting] = useState(false);
  const auth = useAuth();
  const selected = candidates.find((relationship) => relationship.id === selectedId);
  const current = selected ? reviews[selected.id] ?? { state: selected.analystState, explanation: selected.explanation, confidence: selected.relationshipConfidence, notes: selected.analystNotes ?? "" } : undefined;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  function update(patch: Partial<LocalReview>) {
    if (!selected || !current) return;
    setReviews((existing) => ({ ...existing, [selected.id]: { ...current, ...patch } }));
  }

  async function decide(state: AnalystRelationshipState) {
    if (!selected || !current || submitting) return;
    if (!auth.principal) {
      setNotice("Sign in with GitHub before recording a durable relationship decision.");
      return;
    }
    if (!auth.can("relationships:review")) {
      setNotice("The reviewer or administrator role is required for relationship decisions.");
      return;
    }
    setSubmitting(true);
    setNotice(`Recording ${state} with the ARGUS Worker…`);
    try {
      const response = await auth.authenticatedFetch(`/api/admin/relationships/${encodeURIComponent(selected.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analystState: state,
          reason: current.notes.trim() || `Relationship marked ${state} through the ARGUS consequence review.`,
          analystNotes: current.notes || undefined,
          relationshipConfidence: current.confidence,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "The relationship decision was not accepted.");
      }
      const payload = (await response.json()) as { data: { audit: { id: string } } };
      update({ state });
      setNotice(`${selected.id} was durably marked ${state}. Audit ${payload.data.audit.id}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The relationship decision could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  function auxiliary(action: string) {
    update({ action });
    setNotice(`${action} prepared for ${selected?.id}. This MVP records the local intent without claiming a server-side write.`);
  }

  return (
    <section className="grid min-h-[720px] overflow-hidden rounded-xl border border-white/10 bg-[#0a1219] xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside className="border-b border-white/[.08] xl:border-b-0 xl:border-r">
        <header className="border-b border-white/[.08] p-4"><p className="text-[9px] uppercase tracking-[.15em] text-amber-300/70">Automated predictions</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Emerging consequences</h2><p className="mt-2 text-[10px] leading-4 text-slate-600">{candidates.length} evidence-linked hypotheses require analyst judgment.</p></header>
        <div className="max-h-[650px] divide-y divide-white/[.055] overflow-y-auto">{candidates.map((relationship) => { const source = nodeById.get(relationship.sourceNodeId); const target = nodeById.get(relationship.targetNodeId); const state = reviews[relationship.id]?.state ?? relationship.analystState; return <button key={relationship.id} type="button" className={`block w-full p-4 text-left transition ${selectedId === relationship.id ? "bg-amber-300/[.05] shadow-[inset_3px_0_0_rgba(252,211,77,.65)]" : "hover:bg-white/[.02]"}`} onClick={() => setSelectedId(relationship.id)}><div className="flex items-center justify-between gap-2"><StatusBadge tone={state === "disputed" ? "red" : state === "confirmed" ? "green" : "amber"}>{titleCase(state)}</StatusBadge><span className="font-mono text-[10px] text-slate-500">{reviews[relationship.id]?.confidence ?? relationship.relationshipConfidence}%</span></div><p className="mt-3 text-xs font-semibold leading-5 text-slate-200">{source?.label ?? relationship.sourceNodeId}</p><p className="my-1 text-[9px] text-amber-300">↓ {titleCase(relationship.relationshipType)}</p><p className="text-xs font-semibold leading-5 text-slate-300">{target?.label ?? relationship.targetNodeId}</p><p className="mt-2 line-clamp-2 text-[9px] leading-4 text-slate-600">{relationship.explanation}</p></button>; })}</div>
      </aside>

      <div className="min-w-0">
        {selected && current ? <div className="flex min-h-full flex-col">
          <header className="border-b border-white/[.08] p-5 lg:p-6"><div className="flex flex-wrap gap-2"><StatusBadge tone="amber">Hypothesis — analyst review required</StatusBadge><StatusBadge tone="cyan">{titleCase(selected.relationshipType)}</StatusBadge><span className="font-mono text-[9px] text-slate-600">{selected.id}</span></div><h2 className="mt-4 text-xl font-semibold text-slate-100">{nodeById.get(selected.sourceNodeId)?.label} <span className="text-amber-300">→</span> {nodeById.get(selected.targetNodeId)?.label}</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{selected.explanation}</p></header>
          <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_310px] lg:p-6">
            <div className="space-y-5">
              <section className="rounded-lg border border-white/[.08] bg-white/[.018] p-4"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Evidence ledger</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><EvidenceList title="Supporting reports" ids={selected.supportingReportIds} tone="green" /><EvidenceList title="Contradicting reports" ids={selected.contradictingReportIds} tone="red" /></div><dl className="mt-4 grid gap-3 border-t border-white/[.06] pt-4 sm:grid-cols-3"><Meta label="Detection rule" value={titleCase(selected.detectionMethod)} /><Meta label="Created" value={new Date(selected.createdAt).toLocaleString()} /><Meta label="Recalculated" value={new Date(selected.lastRecalculatedAt).toLocaleString()} /></dl></section>
              <section><label className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Editable explanation<textarea className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300 outline-none focus:border-cyan-300/30" value={current.explanation} onChange={(event) => update({ explanation: event.target.value })} /></label></section>
              <section><label className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Analyst notes<textarea className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300 outline-none focus:border-cyan-300/30" value={current.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Record reasoning, caveats, and requested evidence…" /></label></section>
            </div>
            <aside className="space-y-4"><div className="rounded-lg border border-white/[.08] bg-white/[.018] p-4"><ConfidenceMeter score={current.confidence} /><label className="mt-4 block text-[9px] uppercase tracking-[.13em] text-slate-500">Adjust relationship confidence<input className="mt-3 w-full accent-cyan-300" type="range" min="0" max="100" value={current.confidence} onChange={(event) => update({ confidence: Number(event.target.value) })} /></label><dl className="mt-4 grid grid-cols-2 gap-2"><Meta label="Exposure" value={`${selected.exposureConfidence ?? "—"}%`} /><Meta label="Causal" value={`${selected.causalConfidence ?? "—"}%`} /><Meta label="Market anomaly" value={`${selected.marketAnomalyScore ?? "—"}%`} /><Meta label="Model" value={selected.modelVersion} /></dl></div><div className="rounded-lg border border-amber-300/15 bg-amber-300/[.035] p-4 text-[10px] leading-5 text-slate-400"><strong className="text-amber-200">Causality boundary.</strong> Temporal order, geographic overlap, asset exposure, and market movement do not prove that one node caused another.</div></aside>
          </div>
          <div className="border-t border-white/[.08] bg-[#0d161f] p-4"><div className="flex flex-wrap gap-2"><Action icon={<Check size={13} />} label="Confirm" primary disabled={submitting} onClick={() => void decide("confirmed")} /><Action icon={<X size={13} />} label="Reject" danger disabled={submitting} onClick={() => void decide("rejected")} /><Action icon={<SearchCheck size={13} />} label="Mark disputed" disabled={submitting} onClick={() => void decide("disputed")} /><Action icon={<RefreshCw size={13} />} label="Request evidence" onClick={() => auxiliary("More evidence requested")} /><Action icon={<GitMerge size={13} />} label="Merge link" onClick={() => auxiliary("Merge candidate queued")} /><Action icon={<FilePlus2 size={13} />} label="Convert to event" onClick={() => auxiliary("Event conversion queued")} /><Action icon={<BookmarkPlus size={13} />} label="Watchlist" onClick={() => auxiliary("Watchlist addition queued")} /><Action icon={<Pin size={13} />} label="Pin priority" onClick={() => auxiliary("Priority pin queued")} /></div><p className="mt-3 text-[10px] text-slate-500" role="status">{notice}</p></div>
        </div> : <div className="flex min-h-[720px] items-center justify-center p-10 text-center text-sm text-slate-600">No consequence hypotheses are awaiting review.</div>}
      </div>
    </section>
  );
}

function EvidenceList({ title, ids, tone }: { title: string; ids: string[]; tone: "green" | "red" }) {
  return <div className={`rounded-lg border p-3 ${tone === "green" ? "border-emerald-300/15 bg-emerald-300/[.025]" : "border-red-300/15 bg-red-300/[.025]"}`}><p className={`text-[9px] font-semibold uppercase tracking-[.13em] ${tone === "green" ? "text-emerald-300" : "text-red-300"}`}>{title}</p>{ids.length ? <ul className="mt-2 space-y-1 font-mono text-[9px] text-slate-500">{ids.map((id) => <li key={id}>{id}</li>)}</ul> : <p className="mt-2 text-[10px] text-slate-600">No records linked.</p>}</div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[8px] uppercase tracking-[.12em] text-slate-600">{label}</dt><dd className="mt-1 text-[10px] text-slate-300">{value}</dd></div>;
}

function Action({ icon, label, onClick, primary, danger, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} className={`button ${primary ? "button-primary" : ""} ${danger ? "border-red-300/20 text-red-200" : ""}`} onClick={onClick}>{icon}{label}</button>;
}
