import { useMemo, useState } from "react";
import { Download, Pause, Pin, Play, Search } from "lucide-react";
import Link from "@/components/navigation/link";
import { StatusBadge, titleCase } from "@/components/domain/argus-ui";
import { browserDemoDataEnabled } from "@/lib/config/demo-mode";
import type { IntelligenceEvent, IntelligenceSource, SourceReport } from "@/packages/shared/types";

type StreamDisposition = "new" | "duplicate" | "corroborating" | "contradictory" | "updating" | "rejected" | "awaiting-review";

function disposition(report: SourceReport, event?: IntelligenceEvent): StreamDisposition {
  if (report.processingStatus === "duplicate") return "duplicate";
  if (report.processingStatus === "rejected" || report.processingStatus === "failed") return "rejected";
  if (report.processingStatus === "pending" || report.processingStatus === "processing") return "awaiting-review";
  if (!event) return "new";
  if (event.disputedClaims.some((claim) => claim.contradictingReportIds.includes(report.id))) return "contradictory";
  if (event.sourceReportIds[0] === report.id) return "new";
  return event.sourceReportIds.indexOf(report.id) >= Math.max(1, event.sourceReportIds.length - 2) ? "updating" : "corroborating";
}

export function LiveReportStream({ reports, sources, events, compact = false }: { reports: SourceReport[]; sources: IntelligenceSource[]; events: IntelligenceEvent[]; compact?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StreamDisposition | "all">("all");
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const stream = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-US");
    return reports
      .map((report) => ({ report, event: report.eventId ? eventById.get(report.eventId) : undefined }))
      .filter(({ report, event }) => filter === "all" || disposition(report, event) === filter)
      .filter(({ report, event }) => !term || `${report.title} ${report.countryCode ?? ""} ${event?.region ?? ""} ${sourceById.get(report.sourceId)?.name ?? ""}`.toLocaleLowerCase("en-US").includes(term))
      .sort((left, right) => Number(pinned.has(right.report.id)) - Number(pinned.has(left.report.id)) || right.report.collectedAt.localeCompare(left.report.collectedAt));
  }, [eventById, filter, pinned, query, reports, sourceById]);

  function togglePin(id: string) {
    setPinned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportVisible() {
    const safe = stream.map(({ report, event }) => ({
      id: report.id,
      title: report.title,
      sourceId: report.sourceId,
      eventId: report.eventId,
      eventSlug: event?.slug,
      publishedAt: report.publishedAt,
      collectedAt: report.collectedAt,
      processingStatus: report.processingStatus,
      disposition: disposition(report, event),
      dataClassification: report.dataClassification,
    }));
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = browserDemoDataEnabled ? "argus-demonstration-report-stream.json" : "argus-public-report-stream.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1219]">
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-white/[.08] px-3 py-2">
        <div className="mr-auto"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-cyan-300/70">Live collection edge</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Report stream</h2></div>
        <label className="relative min-w-[180px] flex-1 sm:max-w-[280px]"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-slate-600" size={13} /><span className="sr-only">Search live reports</span><input className="h-9 w-full rounded border border-white/10 bg-black/20 pl-8 pr-2 text-[11px] text-slate-300" placeholder="Search feed" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Report disposition" className="h-9 rounded border border-white/10 bg-[#0b141c] px-2 text-[10px] text-slate-400" value={filter} onChange={(event) => setFilter(event.target.value as StreamDisposition | "all")}><option value="all">All processing states</option>{["new", "duplicate", "corroborating", "contradictory", "updating", "rejected", "awaiting-review"].map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select>
        <button type="button" className="icon-button" aria-label={paused ? "Resume live report stream" : "Pause live report stream"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
        <button type="button" className="icon-button" aria-label="Export visible report metadata" onClick={exportVisible}><Download size={14} /></button>
      </header>
      <div className={`${compact ? "max-h-[340px]" : "max-h-[650px]"} divide-y divide-white/[.055] overflow-y-auto`} aria-live={paused ? "off" : "polite"}>
        {stream.slice(0, compact ? 10 : 40).map(({ report, event }) => {
          const source = sourceById.get(report.sourceId);
          const state = disposition(report, event);
          return (
            <article key={report.id} className={`grid gap-3 px-4 py-3 transition hover:bg-white/[.02] ${pinned.has(report.id) ? "bg-cyan-300/[.035]" : ""} sm:grid-cols-[78px_minmax(0,1fr)_auto]`}>
              <div><p className="font-mono text-[9px] text-cyan-200">{new Date(report.collectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" })}Z</p><p className="mt-1 text-[8px] uppercase tracking-[.12em] text-slate-600">collected</p></div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><StatusBadge tone={state === "contradictory" || state === "rejected" ? "red" : state === "new" ? "cyan" : state === "duplicate" ? "neutral" : "amber"}>{titleCase(state)}</StatusBadge>{source?.organization.toLocaleLowerCase("en-US").includes("agency") || source?.organization.toLocaleLowerCase("en-US").includes("service") ? <StatusBadge tone="green">Official source</StatusBadge> : null}{event?.watchlistIds.length ? <StatusBadge tone="violet">Watchlist</StatusBadge> : null}</div><h3 className="mt-2 text-xs font-semibold leading-5 text-slate-200">{report.title}</h3><p className="mt-1 text-[9px] text-slate-600">{source?.name ?? report.sourceId} · published {new Date(report.publishedAt).toLocaleString()} · {report.countryCode ?? event?.region ?? "Global"}</p>{event ? <Link href={`/events/${event.slug}`} className="mt-2 inline-flex text-[10px] text-cyan-300 hover:text-cyan-100">Associated: {event.title.replace(/^\[DEMO\]\s*/, "")}</Link> : null}</div>
              <div className="flex items-start gap-2"><div className="text-right"><p className="font-mono text-xs text-slate-300">{report.confidence ?? event?.automatedConfidence ?? "—"}%</p><p className="text-[8px] uppercase tracking-[.12em] text-slate-600">confidence</p><p className="mt-2 text-[9px] text-slate-500">{report.verificationState ? titleCase(report.verificationState) : `${event?.supportingSourceCount ?? 0} sources`}</p></div><button type="button" className={`icon-button ${pinned.has(report.id) ? "text-cyan-200" : ""}`} aria-label={`${pinned.has(report.id) ? "Unpin" : "Pin"} ${report.title}`} aria-pressed={pinned.has(report.id)} onClick={() => togglePin(report.id)}><Pin size={13} /></button></div>
            </article>
          );
        })}
      </div>
      <footer className="flex items-center justify-between border-t border-white/[.08] px-4 py-2 text-[9px] uppercase tracking-[.12em] text-slate-600"><span>{paused ? "Stream paused by analyst" : browserDemoDataEnabled ? "Processing demonstration reports" : "Processing public reports"}</span><span>{stream.length} visible · syndicated copies are not independent confirmation</span></footer>
    </section>
  );
}
