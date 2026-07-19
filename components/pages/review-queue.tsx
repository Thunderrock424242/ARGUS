"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { IntelligenceEvent } from "@/packages/shared/types";
import { ConfidenceMeter, SeverityMark, StatusBadge, buttonClass, formatDate, primaryButtonClass, titleCase } from "@/components/domain/argus-ui";

type Decision = "confirmed" | "rejected" | "disputed" | "evidence-requested";
type Queue = "priority" | "low-confidence" | "contradictions" | "duplicates" | "watchlists" | "aether";

const queueLabels: Record<Queue, string> = {
  priority: "High-severity unverified",
  "low-confidence": "Low confidence",
  contradictions: "Contradictory claims",
  duplicates: "Possible duplicates",
  watchlists: "Watchlist matches",
  aether: "Aether recommendations",
};

export function ReviewQueue({ events }: { events: IntelligenceEvent[] }) {
  const [queue, setQueue] = useState<Queue>("priority");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [notice, setNotice] = useState("Select a record and use the action controls or keyboard shortcuts.");
  const [showShortcuts, setShowShortcuts] = useState(false);

  const queued = useMemo(() => events.filter((event) => {
    if (decisions[event.id]) return false;
    if (queue === "priority") return event.severity >= 4 && event.verificationState !== "analyst-confirmed";
    if (queue === "low-confidence") return event.automatedConfidence < 60;
    if (queue === "contradictions") return event.contradictionCount > 0 || event.disputedClaims.length > 0;
    if (queue === "duplicates") return event.possibleDuplicateOfEventIds.length > 0;
    if (queue === "watchlists") return event.watchlistIds.length > 0;
    return event.reviewRequired || (event.aetherAssessment?.length ?? 0) > 0;
  }), [decisions, events, queue]);

  const selected = queued[Math.min(selectedIndex, Math.max(0, queued.length - 1))];

  const applyDecision = useCallback((decision: Decision) => {
    if (!selected) return;
    setDecisions((current) => ({ ...current, [selected.id]: decision }));
    setNotice(`${selected.title} marked ${decision.replace("-", " ")} in this demonstration session. This local decision is non-durable and did not write a server audit record.`);
    setSelectedIndex((value) => Math.min(value, Math.max(0, queued.length - 2)));
  }, [queued.length, selected]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      if (event.key === "j" || event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((value) => Math.min(Math.max(0, queued.length - 1), value + 1)); }
      if (event.key === "k" || event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((value) => Math.max(0, value - 1)); }
      if (event.key === "c") applyDecision("confirmed");
      if (event.key === "r") applyDecision("rejected");
      if (event.key === "d") applyDecision("disputed");
      if (event.key === "e") applyDecision("evidence-requested");
      if (event.key === "?") setShowShortcuts((value) => !value);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyDecision, queued.length]);

  const counts = useMemo(() => ({
    priority: events.filter((event) => !decisions[event.id] && event.severity >= 4 && event.verificationState !== "analyst-confirmed").length,
    "low-confidence": events.filter((event) => !decisions[event.id] && event.automatedConfidence < 60).length,
    contradictions: events.filter((event) => !decisions[event.id] && (event.contradictionCount > 0 || event.disputedClaims.length > 0)).length,
    duplicates: events.filter((event) => !decisions[event.id] && event.possibleDuplicateOfEventIds.length > 0).length,
    watchlists: events.filter((event) => !decisions[event.id] && event.watchlistIds.length > 0).length,
    aether: events.filter((event) => !decisions[event.id] && event.reviewRequired).length,
  }), [decisions, events]);

  return (
    <section className="review-workspace grid min-h-[680px] overflow-hidden rounded-xl border border-white/10 bg-[#0b131b] xl:grid-cols-[220px_340px_minmax(0,1fr)]">
      <nav className="border-b border-white/[.08] bg-[#0d161f] p-3 xl:border-b-0 xl:border-r" aria-label="Review queues">
        <div className="mb-3 flex items-center justify-between px-2"><p className="text-[9px] font-bold uppercase tracking-[.17em] text-slate-500">Queues</p><span className="rounded bg-amber-300/10 px-2 py-1 font-mono text-[9px] text-amber-200">{Object.values(counts).reduce((sum, count) => sum + count, 0)}</span></div>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">{(Object.keys(queueLabels) as Queue[]).map((item) => <button key={item} type="button" className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-left text-xs transition ${queue === item ? "bg-cyan-300/[.08] text-cyan-100 shadow-[inset_3px_0_0_rgba(103,232,249,.7)]" : "text-slate-400 hover:bg-white/[.035] hover:text-slate-200"}`} onClick={() => { setQueue(item); setSelectedIndex(0); }}><span>{queueLabels[item]}</span><span className="font-mono text-[9px] text-slate-600">{counts[item]}</span></button>)}</div>
        <div className="mt-5 border-t border-white/[.06] px-2 pt-4"><button type="button" className="text-[10px] font-semibold text-slate-500 hover:text-cyan-200" onClick={() => setShowShortcuts((value) => !value)}>Keyboard shortcuts [?]</button>{showShortcuts && <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[9px] text-slate-500"><dt className="font-mono text-slate-300">J / K</dt><dd>Next / previous</dd><dt className="font-mono text-slate-300">C</dt><dd>Confirm</dd><dt className="font-mono text-slate-300">R</dt><dd>Reject</dd><dt className="font-mono text-slate-300">D</dt><dd>Dispute</dd><dt className="font-mono text-slate-300">E</dt><dd>Request evidence</dd></dl>}</div>
      </nav>

      <div className="border-b border-white/[.08] xl:border-b-0 xl:border-r">
        <div className="flex h-14 items-center justify-between border-b border-white/[.08] px-4"><div><p className="text-[9px] uppercase tracking-[.15em] text-slate-500">Active queue</p><p className="mt-1 text-xs font-semibold text-slate-200">{queueLabels[queue]}</p></div><span className="font-mono text-[10px] text-slate-500">{queued.length} records</span></div>
        <div className="max-h-[620px] divide-y divide-white/[.055] overflow-y-auto" role="listbox" aria-label={`${queueLabels[queue]} events`}>{queued.map((event, index) => <button key={event.id} type="button" role="option" aria-selected={index === selectedIndex} className={`block w-full p-4 text-left transition ${index === selectedIndex ? "bg-cyan-300/[.06] shadow-[inset_3px_0_0_rgba(103,232,249,.65)]" : "hover:bg-white/[.02]"}`} onClick={() => setSelectedIndex(index)}><div className="flex items-center justify-between gap-3"><SeverityMark severity={event.severity} /><span className="font-mono text-[9px] text-slate-600">{event.automatedConfidence}%</span></div><p className="mt-3 text-sm font-semibold leading-5 text-slate-200">{event.title}</p><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">{event.summary}</p><div className="mt-3 flex items-center justify-between text-[9px] uppercase tracking-[.1em] text-slate-600"><span>{event.locationName ?? event.countryName}</span><span>{event.contradictionCount} contradictions</span></div></button>)}</div>
        {queued.length === 0 && <div className="p-10 text-center"><p className="text-sm font-semibold text-slate-300">Queue cleared</p><p className="mt-2 text-xs leading-5 text-slate-600">All matching records have a local demonstration decision.</p></div>}
      </div>

      <div className="min-w-0">
        {selected ? <div className="flex h-full flex-col">
          <div className="border-b border-white/[.08] p-5 lg:p-6"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="amber">Needs review</StatusBadge><StatusBadge tone="cyan">{titleCase(selected.category)}</StatusBadge><span className="font-mono text-[9px] text-slate-600">{selected.id.toUpperCase()}</span></div><h2 className="mt-4 max-w-3xl text-xl font-semibold leading-8 text-slate-50">{selected.title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{selected.summary}</p></div>
          <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_280px] lg:p-6">
            <div className="space-y-5">
              <section><p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Review rationale</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.contradictionCount > 0 && <div className="rounded-lg border border-red-300/15 bg-red-300/[.035] p-3"><p className="text-xs font-semibold text-red-200">Contradictory evidence</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{selected.contradictionCount} contradiction signals require analyst judgment.</p></div>}{selected.possibleDuplicateOfEventIds.length > 0 && <div className="rounded-lg border border-amber-300/15 bg-amber-300/[.035] p-3"><p className="text-xs font-semibold text-amber-200">Possible duplicate</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Correlation threshold overlaps {selected.possibleDuplicateOfEventIds.length} event record(s).</p></div>}{selected.watchlistIds.length > 0 && <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[.035] p-3"><p className="text-xs font-semibold text-cyan-200">Watchlist match</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Matched {selected.watchlistIds.length} active watchlist rule(s).</p></div>}{selected.officialSourceCount === 0 && <div className="rounded-lg border border-white/10 bg-white/[.02] p-3"><p className="text-xs font-semibold text-slate-300">No official source</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Evidence is currently limited to non-official reporting.</p></div>}</div></section>
              <section><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Extracted claims</p><span className="text-[9px] text-slate-600">{selected.confirmedFacts.length + selected.unverifiedClaims.length + selected.disputedClaims.length} total</span></div><div className="mt-3 space-y-2">{[...selected.unverifiedClaims, ...selected.disputedClaims, ...selected.confirmedFacts].slice(0, 5).map((claim) => <div key={claim.id} className="flex items-start gap-3 rounded-lg border border-white/[.07] p-3"><StatusBadge tone={claim.status === "confirmed" ? "green" : claim.status === "disputed" ? "red" : "amber"}>{claim.status}</StatusBadge><div><p className="text-xs leading-5 text-slate-300">{claim.text}</p><p className="mt-1 text-[9px] text-slate-600">{claim.supportingReportIds.length} support · {claim.contradictingReportIds.length} contradict · {claim.confidence}% confidence</p></div></div>)}</div></section>
            </div>
            <aside className="space-y-4"><div className="rounded-lg border border-white/[.08] bg-white/[.018] p-4"><ConfidenceMeter score={selected.automatedConfidence} /><p className="mt-3 text-[10px] leading-4 text-slate-500">Automated confidence measures evidence-rule satisfaction; it is not a probability and does not replace analyst verification.</p></div><dl className="grid grid-cols-2 gap-3 rounded-lg border border-white/[.08] p-4"><div><dt className="text-[8px] uppercase tracking-[.13em] text-slate-600">Reports</dt><dd className="mt-1 text-sm text-slate-200">{selected.sourceReportIds.length}</dd></div><div><dt className="text-[8px] uppercase tracking-[.13em] text-slate-600">Official</dt><dd className="mt-1 text-sm text-slate-200">{selected.officialSourceCount}</dd></div><div><dt className="text-[8px] uppercase tracking-[.13em] text-slate-600">Detected</dt><dd className="mt-1 text-[10px] text-slate-300">{formatDate(selected.firstDetectedAt)}</dd></div><div><dt className="text-[8px] uppercase tracking-[.13em] text-slate-600">Updated</dt><dd className="mt-1 text-[10px] text-slate-300">{formatDate(selected.lastUpdatedAt)}</dd></div></dl><Link href={`/events/${selected.slug}`} className={`${buttonClass} w-full`}>Open full dossier →</Link></aside>
          </div>
          <div className="border-t border-white/[.08] bg-[#0d161f] p-4"><div className="flex flex-wrap items-center gap-2"><button type="button" className={primaryButtonClass} onClick={() => applyDecision("confirmed")}><kbd className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px]">C</kbd> Confirm</button><button type="button" className={buttonClass} onClick={() => applyDecision("disputed")}><kbd className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px]">D</kbd> Mark disputed</button><button type="button" className={buttonClass} onClick={() => applyDecision("evidence-requested")}><kbd className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px]">E</kbd> Request evidence</button><button type="button" className={`${buttonClass} border-red-300/20 text-red-200`} onClick={() => applyDecision("rejected")}><kbd className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px]">R</kbd> Reject</button></div><p className="mt-3 text-[10px] text-slate-500" role="status">{notice}</p></div>
        </div> : <div className="flex h-full items-center justify-center p-10 text-center"><div><p className="text-lg font-semibold text-slate-300">No records in this queue</p><p className="mt-2 text-sm text-slate-600">Choose another queue or refresh the demonstration session.</p></div></div>}
      </div>
    </section>
  );
}
