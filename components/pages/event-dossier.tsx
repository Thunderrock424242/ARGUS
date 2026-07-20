"use client";

import Link from "@/components/navigation/link";
import { useMemo, useState } from "react";
import type { AuditLogEntry, EventTimelineEntry, IntelligenceEvent, IntelligenceGraphNode, IntelligenceRelationship, MarketAsset, MarketImpactAssessment, SourceReport, IntelligenceSource } from "@/packages/shared/types";
import { ConfidenceMeter, PanelHeader, RouteLink, StatusBadge, formatDate, panelClass, titleCase } from "@/components/domain/argus-ui";

const tabs = ["overview", "timeline", "claims", "sources", "entities", "related", "impacts", "audit"] as const;
type DossierTab = (typeof tabs)[number];

function claimTone(status: string): "green" | "amber" | "red" | "cyan" {
  if (status === "confirmed" || status === "corroborated") return "green";
  if (status === "disputed" || status === "rejected") return "red";
  return status === "unverified" ? "amber" : "cyan";
}

function MiniMap({ event }: { event: IntelligenceEvent }) {
  const left = Math.max(3, Math.min(97, (((event.longitude ?? 0) + 180) / 360) * 100));
  const top = Math.max(6, Math.min(94, ((90 - (event.latitude ?? 0)) / 180) * 100));
  return (
    <div className="relative h-52 overflow-hidden rounded-lg border border-white/[.08] bg-[#081119]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(65,105,130,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(65,105,130,.08)_1px,transparent_1px)] bg-[size:10%_20%]" />
      <div className="absolute inset-[14%_5%] opacity-80" aria-hidden="true"><span className="absolute inset-x-[6%] top-[20%] h-[54%] rounded-[44%_40%_50%_45%] border border-cyan-300/[.08] bg-[#14252d] [clip-path:polygon(0_20%,18%_0,37%_20%,50%_4%,72%_26%,100%_18%,92%_55%,76%_60%,68%_92%,51%_72%,42%_100%,29%_64%,10%_75%)]" /></div>
      <span className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-300 shadow-[0_0_0_7px_rgba(103,232,249,.12),0_0_25px_rgba(103,232,249,.7)]" style={{ left: `${left}%`, top: `${top}%` }} />
      <div className="absolute bottom-3 left-3 rounded border border-white/10 bg-black/50 px-2 py-1 font-mono text-[9px] text-slate-300">{event.latitude?.toFixed(4)}, {event.longitude?.toFixed(4)}</div>
    </div>
  );
}

export function EventDossier({
  event,
  reports,
  sources,
  relatedEvents,
  timeline,
  audit,
  graphNodes,
  relationships,
  marketAssets,
  marketImpacts,
}: {
  event: IntelligenceEvent;
  reports: SourceReport[];
  sources: IntelligenceSource[];
  relatedEvents: IntelligenceEvent[];
  timeline: EventTimelineEntry[];
  audit: AuditLogEntry[];
  graphNodes: IntelligenceGraphNode[];
  relationships: IntelligenceRelationship[];
  marketAssets: MarketAsset[];
  marketImpacts: MarketImpactAssessment[];
}) {
  const [tab, setTab] = useState<DossierTab>("overview");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const visibleTimeline = timelineFilter === "all" ? timeline : timeline.filter((entry) => entry.type === timelineFilter);
  const allClaims = [...event.confirmedFacts, ...event.unverifiedClaims, ...event.disputedClaims];

  return (
    <>
      <nav className="tabs flex gap-1 overflow-x-auto rounded-lg border border-white/[.08] bg-[#0d151d] p-1" aria-label="Dossier sections">
        {tabs.map((item) => (
          <button key={item} type="button" className={`min-h-10 shrink-0 rounded-md px-3.5 text-[10px] font-bold uppercase tracking-[.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${tab === item ? "bg-cyan-300/10 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,.14)]" : "text-slate-500 hover:bg-white/[.035] hover:text-slate-300"}`} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="dossier-grid grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <div className="space-y-4">
            <section className={panelClass}>
              <PanelHeader eyebrow="Current assessment" title="Situation overview" />
              <div className="p-5">
                <p className="text-sm leading-7 text-slate-300">{event.summary}</p>
                <div className="mt-5 rounded-lg border border-cyan-300/10 bg-cyan-300/[.04] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-bold uppercase tracking-[.17em] text-cyan-200/70">Aether-generated analysis</p><StatusBadge tone="violet">AI assessment</StatusBadge></div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{event.aetherAssessment ?? "Aether is monitoring the evidence set for changes in corroboration, contradictions, and escalation indicators."}</p>
                </div>
              </div>
            </section>

            <section className={panelClass}>
              <PanelHeader eyebrow="Evidence ledger" title="What is currently known" action={<button type="button" className="text-[10px] font-semibold text-cyan-200" onClick={() => setTab("claims")}>Inspect claims →</button>} />
              <div className="grid gap-4 p-5 lg:grid-cols-3">
                {[
                  { label: "Confirmed facts", values: event.confirmedFacts, tone: "border-emerald-300/15" },
                  { label: "Unverified claims", values: event.unverifiedClaims, tone: "border-amber-300/15" },
                  { label: "Disputed claims", values: event.disputedClaims, tone: "border-red-300/15" },
                ].map((group) => (
                  <div key={group.label} className={`rounded-lg border ${group.tone} bg-black/10 p-4`}>
                    <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-400">{group.label} <span className="ml-1 text-slate-600">{group.values.length}</span></p>
                    <ul className="mt-3 space-y-3">{group.values.slice(0, 3).map((claim) => <li key={claim.id} className="text-xs leading-5 text-slate-300">{claim.text}</li>)}</ul>
                    {group.values.length === 0 && <p className="mt-3 text-xs text-slate-600">No claims in this state.</p>}
                  </div>
                ))}
              </div>
            </section>

            <section className={panelClass}>
              <PanelHeader eyebrow="Analyst workspace" title="Notes and judgment" />
              <div className="p-5"><p className="text-sm leading-6 text-slate-300">{event.analystNotes ?? "No analyst notes have been entered. Automated analysis remains separated from human judgment."}</p>{event.reviewerName && <p className="mt-4 text-[10px] uppercase tracking-[.14em] text-slate-500">Reviewed by {event.reviewerName} · {event.reviewedAt ? formatDate(event.reviewedAt) : "review timestamp unavailable"}</p>}</div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className={panelClass}>
              <PanelHeader eyebrow="Verification" title="Confidence assessment" />
              <div className="space-y-5 p-5">
                <ConfidenceMeter score={event.automatedConfidence} />
                <p className="text-xs leading-5 text-slate-400">{event.confidenceAssessment.explanation}</p>
                <div className="space-y-2">
                  {event.confidenceAssessment.positiveFactors.slice(0, 4).map((factor) => <div key={factor.id} className="flex items-start justify-between gap-3 rounded border border-emerald-300/10 bg-emerald-300/[.025] p-2.5"><div><p className="text-xs text-slate-300">{factor.label}</p><p className="mt-0.5 text-[10px] text-slate-600">{factor.description}</p></div><span className="font-mono text-[10px] text-emerald-300">+{factor.appliedScore}</span></div>)}
                  {event.confidenceAssessment.negativeFactors.slice(0, 3).map((factor) => <div key={factor.id} className="flex items-start justify-between gap-3 rounded border border-red-300/10 bg-red-300/[.025] p-2.5"><div><p className="text-xs text-slate-300">{factor.label}</p><p className="mt-0.5 text-[10px] text-slate-600">{factor.description}</p></div><span className="font-mono text-[10px] text-red-300">{factor.appliedScore}</span></div>)}
                </div>
                <p className="text-[9px] uppercase tracking-[.13em] text-slate-600">Model {event.confidenceAssessment.modelVersion} · score is not a probability</p>
              </div>
            </section>
            <section className={`${panelClass} p-4`}><MiniMap event={event} /><div className="mt-3 flex justify-end"><RouteLink href="/map">Inspect on global map</RouteLink></div></section>
          </aside>
        </div>
      )}

      {tab === "timeline" && (
        <section className={panelClass}>
          <PanelHeader eyebrow="Chronology" title="Event timeline" action={<select className="rounded border border-white/10 bg-[#091119] px-2 py-1.5 text-[10px] text-slate-300" aria-label="Timeline entry type" value={timelineFilter} onChange={(event) => setTimelineFilter(event.target.value)}><option value="all">All entries</option>{[...new Set(timeline.map((item) => item.type))].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>} />
          <ol className="timeline divide-y divide-white/[.06] px-5">{visibleTimeline.map((entry) => <li key={entry.id} className="relative grid gap-3 py-5 pl-8 md:grid-cols-[170px_1fr]"><span className="absolute left-0 top-6 h-3 w-3 rounded-full border-2 border-[#101820] bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.45)]" /><time className="font-mono text-[10px] text-slate-500">{formatDate(entry.occurredAt)}</time><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-200">{entry.title}</h3><StatusBadge tone={entry.type === "contradiction" ? "red" : entry.type === "analyst-decision" ? "green" : "cyan"}>{titleCase(entry.type)}</StatusBadge></div><p className="mt-2 text-xs leading-5 text-slate-400">{entry.description}</p><p className="mt-2 text-[9px] uppercase tracking-[.12em] text-slate-600">Actor: {entry.actor} · {entry.reportIds.length} linked reports</p></div></li>)}</ol>
          {visibleTimeline.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No timeline entries match this filter.</p>}
        </section>
      )}

      {tab === "claims" && (
        <section className={panelClass}>
          <PanelHeader eyebrow="Claim-level verification" title={`${allClaims.length} extracted factual claims`} />
          <div className="divide-y divide-white/[.06]">{allClaims.map((claim) => <article key={claim.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_190px]"><div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={claimTone(claim.status)}>{claim.status}</StatusBadge><span className="font-mono text-[10px] text-slate-500">CLM/{claim.id.slice(-6).toUpperCase()}</span></div><p className="mt-3 text-sm leading-6 text-slate-200">{claim.text}</p><div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500"><span>{claim.supportingReportIds.length} supporting reports</span><span>{claim.contradictingReportIds.length} contradictions</span><span>Updated {formatDate(claim.updatedAt)}</span></div></div><div className="self-center"><ConfidenceMeter score={claim.confidence} /></div></article>)}</div>
        </section>
      )}

      {tab === "sources" && (
        <section className={panelClass}>
          <PanelHeader eyebrow="Evidence provenance" title={`${reports.length} linked source reports`} />
          <div className="overflow-x-auto"><table className="data-table w-full min-w-[850px] text-left"><thead><tr className="border-b border-white/[.08] text-[9px] uppercase tracking-[.14em] text-slate-500"><th className="px-5 py-3">Report</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Published</th><th className="px-4 py-3">Processing</th><th className="px-4 py-3">Provenance</th></tr></thead><tbody className="divide-y divide-white/[.06]">{reports.map((report) => { const source = sourceById.get(report.sourceId); return <tr key={report.id}><td className="px-5 py-4"><p className="max-w-md text-sm font-medium text-slate-200">{report.title}</p><p className="mt-1 font-mono text-[9px] text-slate-600">{report.contentHash.slice(0, 16)}…</p></td><td className="px-4 py-4 text-xs text-slate-300">{source?.name ?? report.sourceId}</td><td className="px-4 py-4 text-[10px] text-slate-500">{formatDate(report.publishedAt)}</td><td className="px-4 py-4"><StatusBadge tone={report.processingStatus === "processed" ? "green" : report.processingStatus === "duplicate" ? "amber" : "red"}>{report.processingStatus}</StatusBadge></td><td className="px-4 py-4"><span className="text-[10px] text-cyan-200">Report {report.id.slice(-5).toUpperCase()}</span></td></tr>; })}</tbody></table></div>
        </section>
      )}

      {tab === "entities" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={panelClass}><PanelHeader eyebrow="Extracted entities" title="Referenced objects" /><div className="grid gap-3 p-5 sm:grid-cols-2">{event.entityIds.map((entityId, index) => <div key={entityId} className="rounded-lg border border-white/[.07] bg-white/[.018] p-4"><StatusBadge tone={index % 3 === 0 ? "cyan" : index % 3 === 1 ? "violet" : "neutral"}>{index % 3 === 0 ? "organization" : index % 3 === 1 ? "location" : "infrastructure"}</StatusBadge><p className="mt-3 text-sm font-semibold text-slate-200">{titleCase(entityId.replace(/^entity-/, ""))}</p><p className="mt-1 font-mono text-[9px] text-slate-600">{entityId}</p></div>)}</div></section>
          <section className={panelClass}><PanelHeader eyebrow="Event taxonomy" title="Tags and watchlist matches" /><div className="p-5"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Tags</p><div className="mt-3 flex flex-wrap gap-2">{event.tags.map((tag) => <span key={tag} className="rounded border border-cyan-300/10 bg-cyan-300/[.04] px-2.5 py-1.5 text-[10px] text-cyan-100/80">#{tag}</span>)}</div><p className="mt-6 text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Watchlist matches</p><div className="mt-3 space-y-2">{event.watchlistIds.map((id) => <div key={id} className="flex items-center justify-between rounded border border-white/[.07] p-3"><span className="text-xs text-slate-300">{titleCase(id.replace(/^watch-/, ""))}</span><Link href="/watchlists" className="text-[10px] text-cyan-200">Inspect →</Link></div>)}{event.watchlistIds.length === 0 && <p className="text-xs text-slate-600">No active watchlist matches.</p>}</div></div></section>
        </div>
      )}

      {tab === "related" && (
        <section className={panelClass}><PanelHeader eyebrow="Correlation graph" title={`${relatedEvents.length} related intelligence events`} /><div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{relatedEvents.map((related) => <Link key={related.id} href={`/events/${related.slug}`} className="rounded-lg border border-white/[.08] bg-white/[.018] p-4 transition hover:border-cyan-300/25 hover:bg-cyan-300/[.025]"><div className="flex items-center justify-between"><StatusBadge tone="cyan">{titleCase(related.category)}</StatusBadge><span className="font-mono text-[10px] text-slate-500">{related.automatedConfidence}%</span></div><h3 className="mt-4 text-sm font-semibold leading-5 text-slate-200">{related.title}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{related.summary}</p></Link>)}{relatedEvents.length === 0 && <p className="text-sm text-slate-500">No related events have crossed the correlation threshold.</p>}</div></section>
      )}

      {tab === "impacts" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className={panelClass}><PanelHeader eyebrow="Graph intelligence" title="Event relationships" action={<Link href="/relationships" className="text-[10px] font-semibold text-cyan-200">Open full graph →</Link>} /><div className="divide-y divide-white/[.06]">{relationships.map((relationship) => { const source = graphNodes.find((node) => node.id === relationship.sourceNodeId); const target = graphNodes.find((node) => node.id === relationship.targetNodeId); return <article key={relationship.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={relationship.analystState === "confirmed" ? "green" : relationship.analystState === "disputed" || relationship.analystState === "rejected" ? "red" : "amber"}>{titleCase(relationship.analystState)}</StatusBadge><StatusBadge tone="cyan">{titleCase(relationship.relationshipType)}</StatusBadge></div><p className="mt-3 text-sm font-semibold text-slate-200">{source?.label ?? relationship.sourceNodeId} → {target?.label ?? relationship.targetNodeId}</p><p className="mt-2 text-xs leading-5 text-slate-500">{relationship.explanation}</p><dl className="mt-3 grid grid-cols-4 gap-2"><ImpactScore label="Relationship" value={relationship.relationshipConfidence} /><ImpactScore label="Exposure" value={relationship.exposureConfidence} /><ImpactScore label="Causal" value={relationship.causalConfidence} /><ImpactScore label="Anomaly" value={relationship.marketAnomalyScore} /></dl><p className="mt-3 text-[9px] text-slate-600">{relationship.supportingReportIds.length} supporting · {relationship.contradictingReportIds.length} contradicting · {titleCase(relationship.detectionMethod)}</p></article>; })}{relationships.length === 0 ? <div className="p-8 text-center text-sm text-slate-600">No graph relationship is associated with this event.</div> : null}</div></section>
          <section className={panelClass}><PanelHeader eyebrow="Market monitoring" title="Possible market impact" /><div className="divide-y divide-white/[.06]">{marketImpacts.map((assessment) => { const asset = marketAssets.find((candidate) => candidate.id === assessment.assetId); return <article key={assessment.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-sm font-semibold text-slate-200">{asset?.symbol ?? assessment.assetId}</p><StatusBadge tone={assessment.marketAnomalyScore >= 70 ? "amber" : "neutral"}>{assessment.marketAnomalyScore} anomaly</StatusBadge></div><p className="mt-1 text-[9px] text-slate-600">{asset?.name}</p><p className="mt-3 text-[10px] leading-5 text-slate-400">{assessment.explanation}</p><div className="mt-3 rounded border border-amber-300/15 bg-amber-300/[.03] p-3 text-[9px] leading-4 text-amber-100">Causal confidence {assessment.causalConfidence}%. Timing and exposure do not establish causation.</div></article>; })}{marketImpacts.length === 0 ? <div className="p-8 text-center text-sm text-slate-600">No unusual market movement is associated with this event.</div> : null}</div></section>
        </div>
      )}

      {tab === "audit" && (
        <section className={panelClass}><PanelHeader eyebrow="Immutable activity record" title="Analyst and system audit log" /><div className="divide-y divide-white/[.06]">{audit.map((entry) => <article key={entry.id} className="grid gap-3 p-5 md:grid-cols-[170px_1fr_auto]"><time className="font-mono text-[10px] text-slate-500">{formatDate(entry.occurredAt)}</time><div><p className="text-sm font-medium text-slate-200">{entry.summary}</p><p className="mt-1 text-[10px] text-slate-500">{entry.actorName} · {titleCase(entry.actorType)} · Correlation {entry.correlationId.slice(-8)}</p>{entry.reason && <p className="mt-2 text-xs text-slate-400">Reason: {entry.reason}</p>}</div><StatusBadge tone={entry.actorType === "analyst" ? "green" : entry.actorType === "Aether" ? "violet" : "cyan"}>{titleCase(entry.action)}</StatusBadge></article>)}</div>{audit.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No audit actions recorded for this event.</p>}</section>
      )}
    </>
  );
}

function ImpactScore({ label, value }: { label: string; value?: number }) {
  return <div className="rounded border border-white/[.06] p-2 text-center"><dt className="text-[7px] uppercase tracking-[.1em] text-slate-600">{label}</dt><dd className="mt-1 font-mono text-[10px] text-slate-300">{value === undefined ? "—" : `${value}%`}</dd></div>;
}
