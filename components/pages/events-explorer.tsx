"use client";

import Link from "@/components/navigation/link";
import { useDeferredValue, useMemo, useState } from "react";
import type { IntelligenceEvent } from "@/packages/shared/types";
import { ConfidenceMeter, SeverityMark, StatusBadge, controlClass, formatDate, titleCase } from "@/components/domain/argus-ui";

const PAGE_SIZE = 8;

function verificationTone(value: IntelligenceEvent["verificationState"]): "green" | "amber" | "red" | "cyan" {
  if (value === "analyst-confirmed") return "green";
  if (value === "analyst-rejected" || value === "disputed") return "red";
  if (value === "needs-review") return "amber";
  return "cyan";
}

export function EventsExplorer({ events }: { events: IntelligenceEvent[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [verification, setVerification] = useState("all");
  const [minimumSeverity, setMinimumSeverity] = useState(1);
  const [sort, setSort] = useState("priority");
  const [view, setView] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);

  const categories = useMemo(() => [...new Set(events.map((event) => event.category))].sort(), [events]);
  const statuses = useMemo(() => [...new Set(events.map((event) => event.status))].sort(), [events]);

  const filtered = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    const result = events.filter((event) => {
      const searchable = `${event.title} ${event.summary} ${event.locationName ?? ""} ${event.countryName ?? ""} ${event.tags.join(" ")}`.toLowerCase();
      return (!term || searchable.includes(term))
        && (category === "all" || event.category === category)
        && (status === "all" || event.status === status)
        && (verification === "all" || event.verificationState === verification)
        && event.severity >= minimumSeverity;
    });
    return result.sort((a, b) => {
      if (sort === "confidence") return b.automatedConfidence - a.automatedConfidence;
      if (sort === "updated") return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime();
      if (sort === "oldest") return new Date(a.firstDetectedAt).getTime() - new Date(b.firstDetectedAt).getTime();
      return (b.severity * 20 + b.automatedConfidence) - (a.severity * 20 + a.automatedConfidence);
    });
  }, [category, deferredQuery, events, minimumSeverity, sort, status, verification]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="space-y-4">
      <div className="toolbar rounded-xl border border-white/10 bg-[#101820]/90 p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(130px,.65fr))_auto]">
          <label className="relative">
            <span className="sr-only">Search events</span>
            <input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search events, locations, tags…" />
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">⌕</span>
          </label>
          <select aria-label="Filter category" className={controlClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="all">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
          <select aria-label="Filter status" className={controlClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
          </select>
          <select aria-label="Filter verification" className={controlClass} value={verification} onChange={(event) => { setVerification(event.target.value); setPage(1); }}>
            <option value="all">All verification</option>
            <option value="needs-review">Needs review</option>
            <option value="analyst-confirmed">Analyst confirmed</option>
            <option value="disputed">Disputed</option>
            <option value="automated">Automated</option>
          </select>
          <select aria-label="Minimum severity" className={controlClass} value={minimumSeverity} onChange={(event) => { setMinimumSeverity(Number(event.target.value)); setPage(1); }}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Severity {value}+</option>)}
          </select>
          <select aria-label="Sort events" className={controlClass} value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
            <option value="priority">Priority order</option>
            <option value="updated">Recently updated</option>
            <option value="confidence">Highest confidence</option>
            <option value="oldest">First detected</option>
          </select>
          <div className="flex rounded-md border border-white/10 bg-[#0a1118] p-1" role="group" aria-label="Display mode">
            <button type="button" className={`min-h-8 rounded px-3 text-xs font-semibold ${view === "table" ? "bg-cyan-300/10 text-cyan-100" : "text-slate-500 hover:text-slate-300"}`} aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
            <button type="button" className={`min-h-8 rounded px-3 text-xs font-semibold ${view === "cards" ? "bg-cyan-300/10 text-cyan-100" : "text-slate-500 hover:text-slate-300"}`} aria-pressed={view === "cards"} onClick={() => setView("cards")}>Cards</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.06] pt-3 text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">
          <span>{filtered.length} of {events.length} intelligence events</span>
          <button type="button" className="text-cyan-200 hover:text-cyan-100" onClick={() => { setQuery(""); setCategory("all"); setStatus("all"); setVerification("all"); setMinimumSeverity(1); }}>Clear all filters</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state rounded-xl border border-dashed border-white/10 bg-white/[.02] p-12 text-center">
          <p className="text-sm font-semibold text-slate-300">No events match these filters</p>
          <p className="mt-2 text-xs text-slate-500">Broaden the criteria or clear all filters to restore the intelligence feed.</p>
        </div>
      ) : view === "table" ? (
        <div className="table-wrap overflow-x-auto rounded-xl border border-white/10 bg-[#101820]/90">
          <table className="data-table w-full min-w-[1050px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[.08] bg-white/[.018] text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">
                <th className="px-4 py-3">Event</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Confidence</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Reports</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {visible.map((event) => (
                <tr key={event.id} className="group transition hover:bg-cyan-300/[.025]">
                  <td className="max-w-[420px] px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${event.severity >= 5 ? "bg-red-400" : event.severity === 4 ? "bg-orange-400" : "bg-cyan-300"}`} />
                      <div><Link href={`/events/${event.slug}`} className="text-sm font-semibold text-slate-100 transition group-hover:text-cyan-100">{event.title}</Link><p className="mt-1 line-clamp-1 text-xs text-slate-500">{event.locationName ?? event.countryName} · {titleCase(event.category)} · {titleCase(event.status)}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><SeverityMark severity={event.severity} /></td>
                  <td className="w-40 px-4 py-4"><ConfidenceMeter score={event.automatedConfidence} compact /></td>
                  <td className="px-4 py-4"><StatusBadge tone={verificationTone(event.verificationState)}>{titleCase(event.verificationState)}</StatusBadge></td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-300">{event.sourceReportIds.length}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-[10px] text-slate-500">{formatDate(event.lastUpdatedAt)}</td>
                  <td className="px-4 py-4"><Link href={`/events/${event.slug}`} className="text-sm text-cyan-200" aria-label={`Open ${event.title}`}>→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((event) => (
            <article key={event.id} className="panel flex min-h-72 flex-col rounded-xl border border-white/10 bg-[#101820]/90 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/20">
              <div className="flex items-center justify-between gap-3"><SeverityMark severity={event.severity} /><StatusBadge tone={verificationTone(event.verificationState)}>{titleCase(event.verificationState)}</StatusBadge></div>
              <h2 className="mt-5 text-base font-semibold leading-6 text-slate-100"><Link href={`/events/${event.slug}`} className="hover:text-cyan-100">{event.title}</Link></h2>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{event.summary}</p>
              <div className="my-5"><ConfidenceMeter score={event.automatedConfidence} /></div>
              <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/[.06] pt-4 text-[10px] uppercase tracking-[.12em] text-slate-500"><span>{event.locationName ?? event.countryName}</span><span>{event.sourceReportIds.length} reports</span></div>
            </article>
          ))}
        </div>
      )}

      <nav className="flex items-center justify-between rounded-lg border border-white/[.08] bg-[#0e161e] px-3 py-2" aria-label="Events pagination">
        <button type="button" className="min-h-9 rounded px-3 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-30" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button>
        <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">Page {safePage} / {totalPages}</span>
        <button type="button" className="min-h-9 rounded px-3 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-30" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next →</button>
      </nav>
    </section>
  );
}
