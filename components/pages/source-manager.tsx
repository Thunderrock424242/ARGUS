"use client";

import { useMemo, useState } from "react";
import type { IntelligenceSource } from "@/packages/shared/types";
import { StatusBadge, buttonClass, controlClass, formatDate, primaryButtonClass, titleCase } from "@/components/domain/argus-ui";

type RunState = { sourceId: string; status: "running" | "complete" } | null;

export function SourceManager({ initialSources }: { initialSources: IntelligenceSource[] }) {
  const [sources, setSources] = useState(initialSources);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [run, setRun] = useState<RunState>(null);
  const [notice, setNotice] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sources.filter((source) => (!term || `${source.name} ${source.organization} ${source.region ?? ""} ${source.categories.join(" ")}`.toLowerCase().includes(term)) && (status === "all" || source.status === status));
  }, [query, sources, status]);

  function toggleSource(sourceId: string) {
    setSources((current) => current.map((source) => source.id === sourceId ? { ...source, enabled: !source.enabled, status: source.enabled ? "paused" : "online" } : source));
    setNotice("Collector state updated in this local demonstration session.");
  }

  function runCollector(sourceId: string) {
    if (run?.status === "running") return;
    setRun({ sourceId, status: "running" });
    setNotice("Collector run queued. This demonstration does not contact an external service.");
    window.setTimeout(() => {
      setRun({ sourceId, status: "complete" });
      setSources((current) => current.map((source) => source.id === sourceId ? { ...source, status: "online", lastCheckedAt: new Date().toISOString(), recentFailureCount: 0 } : source));
      setNotice("Demonstration collector completed with a simulated successful health check.");
    }, 900);
  }

  function testConnection(sourceId: string) {
    const source = sources.find((item) => item.id === sourceId);
    setNotice(`${source?.name ?? "Source"} connection test passed using the deterministic mock adapter; no network request was made.`);
  }

  function submitFeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    let url: URL;
    try { url = new URL(feedUrl); } catch { setFormError("Enter a valid HTTPS URL."); return; }
    if (url.protocol !== "https:") { setFormError("Only HTTPS feeds are accepted."); return; }
    if (!feedName.trim()) { setFormError("Enter a descriptive source name."); return; }
    setNotice(`${feedName.trim()} passed client-side checks. A production deployment would now perform server-side SSRF validation before saving.`);
    setShowAdd(false); setFeedName(""); setFeedUrl("");
  }

  return (
    <>
      <section className="space-y-4">
        <div className="toolbar grid gap-3 rounded-xl border border-white/10 bg-[#101820]/90 p-3 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
          <label className="relative"><span className="sr-only">Search sources</span><input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source or publisher…" /><span className="absolute left-3 top-2.5 text-slate-500">⌕</span></label>
          <select className={controlClass} aria-label="Filter source status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All source states</option><option value="online">Online</option><option value="degraded">Degraded</option><option value="offline">Offline</option><option value="paused">Paused</option></select>
          <button type="button" className={primaryButtonClass} onClick={() => setShowAdd(true)}>＋ Add RSS source</button>
        </div>

        {notice && <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[.045] px-4 py-3 text-xs text-cyan-100/80" role="status">{notice}</div>}

        <div className="table-wrap overflow-x-auto rounded-xl border border-white/10 bg-[#101820]/90">
          <table className="data-table w-full min-w-[1260px] text-left">
            <thead><tr className="border-b border-white/[.08] text-[9px] font-bold uppercase tracking-[.15em] text-slate-500"><th className="px-4 py-3">Source</th><th className="px-4 py-3">Type / scope</th><th className="px-4 py-3">Reliability</th><th className="px-4 py-3">Independence</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Last success</th><th className="px-4 py-3">Collection</th><th className="px-4 py-3">Enabled</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-white/[.06]">{filtered.map((source) => (
              <tr key={source.id} className="align-top transition hover:bg-white/[.015]">
                <td className="px-4 py-4"><div className="flex items-start gap-3"><span className={`mt-1 h-2 w-2 rounded-full ${source.status === "online" ? "bg-emerald-400" : source.status === "degraded" ? "bg-amber-300" : source.status === "paused" ? "bg-slate-500" : "bg-red-400"}`} /><div><p className="text-sm font-semibold text-slate-200">{source.name}</p><p className="mt-1 text-[10px] text-slate-500">{source.organization}</p><p className="mt-2 max-w-64 text-[10px] leading-4 text-slate-600">{source.limitations}</p></div></div></td>
                <td className="px-4 py-4"><StatusBadge tone="cyan">{source.type}</StatusBadge><p className="mt-2 text-[10px] text-slate-500">{source.region ?? source.countryCode ?? "Global"}</p><p className="mt-1 max-w-44 text-[10px] text-slate-600">{source.categories.map(titleCase).join(" · ")}</p></td>
                <td className="px-4 py-4"><div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-slate-200">{source.reliabilityScore}</span><span className="text-[9px] text-slate-600">/100</span></div><div className="mt-2 h-1 w-24 rounded bg-white/[.06]"><div className={`h-full rounded ${source.reliabilityScore >= 85 ? "bg-emerald-400" : source.reliabilityScore >= 70 ? "bg-cyan-300" : "bg-amber-300"}`} style={{ width: `${source.reliabilityScore}%` }} /></div></td>
                <td className="px-4 py-4"><p className="text-xs text-slate-300">{source.independenceGroup}</p><p className="mt-1 text-[9px] text-slate-600">Syndication checked</p></td>
                <td className="px-4 py-4"><p className="text-xs text-slate-300">{source.schedule.label}</p><p className="mt-1 font-mono text-[9px] text-slate-600">{source.schedule.cron ?? `every ${source.schedule.intervalMinutes}m`}</p></td>
                <td className="px-4 py-4"><p className="whitespace-nowrap text-[10px] text-slate-400">{source.lastSuccessfulCollectionAt ? formatDate(source.lastSuccessfulCollectionAt) : "Never"}</p><p className={`mt-1 text-[9px] ${source.recentFailureCount ? "text-red-300" : "text-slate-600"}`}>{source.recentFailureCount} recent failures</p></td>
                <td className="px-4 py-4"><p className="font-mono text-sm text-slate-200">{source.reportsCollected.toLocaleString()}</p><p className="mt-1 text-[9px] uppercase tracking-[.12em] text-slate-600">reports</p></td>
                <td className="px-4 py-4"><button type="button" role="switch" aria-checked={source.enabled} aria-label={`${source.enabled ? "Disable" : "Enable"} ${source.name}`} onClick={() => toggleSource(source.id)} className={`relative h-6 w-11 rounded-full transition ${source.enabled ? "bg-cyan-300/30" : "bg-slate-700"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-slate-100 transition ${source.enabled ? "left-6" : "left-1"}`} /></button></td>
                <td className="px-4 py-4"><div className="flex flex-col items-start gap-1"><button type="button" className="min-h-8 text-[10px] font-semibold text-cyan-200 disabled:opacity-40" disabled={!source.enabled || run?.status === "running"} onClick={() => runCollector(source.id)}>{run?.sourceId === source.id && run.status === "running" ? "Running…" : "Run collector"}</button><button type="button" className="min-h-8 text-[10px] font-semibold text-slate-400 hover:text-slate-200" onClick={() => testConnection(source.id)}>Test connection</button><button type="button" className="min-h-8 text-[10px] font-semibold text-slate-400 hover:text-slate-200" onClick={() => setNotice(`Showing the last five deterministic collector log entries for ${source.name}.`)}>View logs</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}><section className="w-full max-w-lg rounded-xl border border-white/10 bg-[#111b24] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="add-feed-title"><div className="flex items-center justify-between border-b border-white/[.08] px-5 py-4"><div><p className="text-[9px] uppercase tracking-[.15em] text-cyan-300/70">Source intake</p><h2 id="add-feed-title" className="mt-1 text-lg font-semibold text-slate-100">Add an RSS or Atom feed</h2></div><button type="button" className="h-10 w-10 rounded text-slate-400 hover:bg-white/[.05] hover:text-white" aria-label="Close dialog" onClick={() => setShowAdd(false)}>×</button></div><form className="space-y-4 p-5" onSubmit={submitFeed}><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Source name</span><input autoFocus className={`${controlClass} w-full`} value={feedName} onChange={(event) => setFeedName(event.target.value)} placeholder="Regional emergency bulletin" /></label><label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">HTTPS feed URL</span><input className={`${controlClass} w-full`} type="url" value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} placeholder="https://example.org/alerts.xml" /></label><p className="text-xs leading-5 text-slate-500">This demonstration form checks HTTPS syntax only. It does not contact or save the feed; production persistence must use ARGUS&apos;s protected server-side SSRF validation and audit workflow.</p>{formError && <p className="text-xs text-red-300" role="alert">{formError}</p>}<div className="flex justify-end gap-2 border-t border-white/[.06] pt-4"><button type="button" className={buttonClass} onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className={primaryButtonClass}>Validate syntax</button></div></form></section></div>}
    </>
  );
}
