import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Layers3, Radio, ShieldAlert, Volume2, VolumeX } from "lucide-react";
import Link from "@/components/navigation/link";
import { OperationsMap } from "@/components/dashboard/operations-map";
import { DemoBanner, StatusBadge } from "@/components/domain/argus-ui";
import type {
  IntelligenceAlert,
  IntelligenceEvent,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  IntelligenceSource,
  MarketImpactAssessment,
  PlatformMetrics,
  SourceReport,
} from "@/packages/shared/types";
import { LiveReportStream } from "./live-report-stream";
import { browserDemoDataEnabled, recordsVisibleInDemoMode } from "@/lib/config/demo-mode";

const operationalLayers = [
  { id: "security", label: "Security", categories: "Conflict · unrest · sanctions", tone: "bg-red-400" },
  { id: "infrastructure", label: "Infrastructure", categories: "Power · ports · transport", tone: "bg-orange-300" },
  { id: "natural", label: "Natural events", categories: "Seismic · fire · weather", tone: "bg-cyan-300" },
  { id: "cyber", label: "Cyber", categories: "Vulnerabilities · incidents", tone: "bg-violet-300" },
  { id: "markets", label: "Markets", categories: "Assets · anomalies · exposure", tone: "bg-emerald-300" },
  { id: "humanitarian", label: "Humanitarian", categories: "Access · health · displacement", tone: "bg-amber-200" },
] as const;

const brainApiUrl = import.meta.env.VITE_ARGUS_API_URL?.replace(/\/+$/, "") ?? "";

type OperationsRuntimeData = {
  events: IntelligenceEvent[];
  reports: SourceReport[];
  sources: IntelligenceSource[];
  relationships: IntelligenceRelationship[];
  graphNodes: IntelligenceGraphNode[];
  marketImpacts: MarketImpactAssessment[];
  alerts: IntelligenceAlert[];
  metrics: PlatformMetrics;
};

type RuntimeDataSource = "fixtures" | "syncing" | "d1" | "worker-fixtures" | "degraded";

export function GlobalOperationsView({
  events,
  reports,
  sources,
  relationships,
  graphNodes,
  marketImpacts,
  alerts,
  metrics,
}: {
  events: IntelligenceEvent[];
  reports: SourceReport[];
  sources: IntelligenceSource[];
  relationships: IntelligenceRelationship[];
  graphNodes: IntelligenceGraphNode[];
  marketImpacts: MarketImpactAssessment[];
  alerts: IntelligenceAlert[];
  metrics: PlatformMetrics;
}) {
  const [runtimeData, setRuntimeData] = useState<OperationsRuntimeData>(() => ({
    events,
    reports,
    sources,
    relationships,
    graphNodes,
    marketImpacts,
    alerts,
    metrics,
  }));
  const [runtimeDataSource, setRuntimeDataSource] = useState<RuntimeDataSource>(
    brainApiUrl ? "syncing" : browserDemoDataEnabled ? "fixtures" : "degraded",
  );
  const [now, setNow] = useState(() => new Date());
  const [enabledLayers, setEnabledLayers] = useState(() => new Set(operationalLayers.map((layer) => layer.id)));
  const [layerOpacity, setLayerOpacity] = useState(80);
  const [audioEnabled, setAudioEnabled] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!brainApiUrl) return;
    const controller = new AbortController();
    void fetch(`${brainApiUrl}/api/operations/snapshot`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`ARGUS Worker returned ${response.status}.`);
        const payload = await response.json() as {
          data?: Partial<OperationsRuntimeData>;
          meta?: { demoDataEnabled?: boolean };
        };
        const data = payload.data;
        if (!data || !Array.isArray(data.events) || !Array.isArray(data.reports) || !Array.isArray(data.sources) || !Array.isArray(data.relationships) || !Array.isArray(data.graphNodes) || !Array.isArray(data.marketImpacts) || !Array.isArray(data.alerts) || !data.metrics) {
          throw new Error("ARGUS Worker returned an invalid operations snapshot.");
        }
        const effectiveDemoEnabled = browserDemoDataEnabled && payload.meta?.demoDataEnabled !== false;
        const visibleReports = recordsVisibleInDemoMode(data.reports, effectiveDemoEnabled) ?? [];
        setRuntimeData({
          events: recordsVisibleInDemoMode(data.events, effectiveDemoEnabled) ?? [],
          reports: visibleReports.sort((left, right) => right.collectedAt.localeCompare(left.collectedAt)),
          sources: recordsVisibleInDemoMode(data.sources, effectiveDemoEnabled) ?? [],
          relationships: recordsVisibleInDemoMode(data.relationships, effectiveDemoEnabled) ?? [],
          graphNodes: recordsVisibleInDemoMode(data.graphNodes, effectiveDemoEnabled) ?? [],
          marketImpacts: recordsVisibleInDemoMode(data.marketImpacts, effectiveDemoEnabled) ?? [],
          alerts: recordsVisibleInDemoMode(data.alerts, effectiveDemoEnabled) ?? [],
          metrics: !effectiveDemoEnabled && data.metrics.dataClassification === "demonstration"
            ? metrics
            : data.metrics,
        });
        setRuntimeDataSource(response.headers.get("x-argus-data-store") === "d1" ? "d1" : "worker-fixtures");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRuntimeDataSource("degraded");
      });
    return () => controller.abort();
  }, [metrics]);
  const priorityEvents = useMemo(() => runtimeData.events.filter((event) => event.priority).sort((left, right) => right.severity - left.severity), [runtimeData.events]);
  const reviewRelationships = runtimeData.relationships.filter((relationship) => relationship.analystState === "needs-review").length;
  const marketAnomalies = runtimeData.marketImpacts.filter((assessment) => assessment.marketAnomalyScore >= 70).length;

  function toggleLayer(id: (typeof operationalLayers)[number]["id"]) {
    setEnabledLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#05090d]">
      <DemoBanner />
      <section className="border-b border-white/[.08] bg-[linear-gradient(90deg,rgba(8,145,178,.08),transparent_38%,rgba(239,68,68,.04))] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="mr-auto"><div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50 motion-reduce:animate-none" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span><p className="text-[9px] font-bold uppercase tracking-[.19em] text-emerald-300">Global collection active</p></div><h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">Global Operations View</h1></div>
          <Clock label="UTC" value={now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })} />
          <Clock label="Local" value={now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} />
          <div className="hidden h-9 w-px bg-white/10 md:block" />
          <StatusBadge tone={runtimeDataSource === "degraded" ? "amber" : "green"}><Radio size={11} /> {runtimeData.metrics.sourcesOnline}/{runtimeData.metrics.sourcesTotal} collectors</StatusBadge>
          <StatusBadge tone={reviewRelationships ? "amber" : "green"}><ShieldAlert size={11} /> {reviewRelationships} consequences</StatusBadge>
          <StatusBadge tone={marketAnomalies ? "red" : "green"}><Activity size={11} /> {marketAnomalies} anomalies</StatusBadge>
          <button type="button" className={`button ${audioEnabled ? "border-cyan-300/30 text-cyan-100" : ""}`} aria-pressed={audioEnabled} onClick={() => setAudioEnabled((value) => !value)}>{audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} {audioEnabled ? "ARGUS audio enabled" : "Enable ARGUS audio"}</button>
        </div>
      </section>

      <section className="grid min-h-[720px] xl:grid-cols-[230px_minmax(0,1fr)_330px]">
        <aside className="border-b border-white/[.08] bg-[#0a1118] p-4 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2"><Layers3 size={15} className="text-cyan-300" /><h2 className="text-xs font-semibold uppercase tracking-[.13em] text-slate-300">Operational layers</h2></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{operationalLayers.map((layer) => <button key={layer.id} type="button" className={`rounded-lg border p-3 text-left transition ${enabledLayers.has(layer.id) ? "border-white/10 bg-white/[.035]" : "border-white/[.05] opacity-55"}`} aria-pressed={enabledLayers.has(layer.id)} onClick={() => toggleLayer(layer.id)}><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${layer.tone}`} /><span className="text-xs font-semibold text-slate-300">{layer.label}</span><span className="ml-auto font-mono text-[9px] text-slate-600">{enabledLayers.has(layer.id) ? "ON" : "OFF"}</span></div><p className="mt-2 text-[9px] leading-4 text-slate-600">{layer.categories}</p></button>)}</div>
          <label className="mt-5 block border-t border-white/[.06] pt-4"><span className="flex justify-between text-[9px] uppercase tracking-[.13em] text-slate-500"><span>Overlay opacity</span><span>{layerOpacity}%</span></span><input type="range" min="20" max="100" value={layerOpacity} onChange={(event) => setLayerOpacity(Number(event.target.value))} className="mt-3 w-full accent-cyan-300" /></label>
          <div className="mt-5 rounded-lg border border-white/[.07] bg-black/20 p-3 text-[9px] leading-4 text-slate-600"><p className="font-semibold uppercase tracking-[.12em] text-slate-400">Layer provenance</p><p className="mt-2">{runtimeDataSource === "d1" ? "D1 Worker read models" : runtimeDataSource === "syncing" ? "Synchronizing with ARGUS Worker" : runtimeDataSource === "degraded" ? (browserDemoDataEnabled ? "Worker unavailable · bundled fallback active" : "Worker unavailable · demo fallback disabled") : "Fictional fixture providers"} · refreshed {new Date(runtimeData.metrics.generatedAt).toLocaleTimeString()} · use Sources for collector limitations and attribution.</p></div>
        </aside>

        <div className="min-w-0 bg-[#060c11] p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,.45)]">
            <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-white/[.08] bg-[#071019]/95 px-3 py-2" aria-label="Map intelligence summary"><span className="rounded border border-cyan-300/20 bg-[#071019] px-2 py-1 text-[9px] uppercase tracking-[.13em] text-cyan-200">{runtimeData.events.length} correlated events</span><span className="rounded border border-amber-300/20 bg-[#071019] px-2 py-1 text-[9px] uppercase tracking-[.13em] text-amber-200">{runtimeData.relationships.length} impact links</span><span className="rounded border border-white/10 bg-[#071019] px-2 py-1 text-[9px] uppercase tracking-[.13em] text-slate-400">Layer opacity {layerOpacity}%</span></div>
            <OperationsMap events={runtimeData.events} nodes={runtimeData.graphNodes} relationships={runtimeData.relationships} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">{priorityEvents.slice(0, 3).map((event) => <Link key={event.id} href={`/events/${event.slug}`} className="rounded-lg border border-white/[.08] bg-[#0b141c] p-3 transition hover:border-cyan-300/20"><div className="flex items-center gap-2"><span className={`severity severity-${event.severity}`}>S{event.severity}</span><StatusBadge tone={event.status === "developing" ? "amber" : "cyan"}>{event.status}</StatusBadge></div><h3 className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-200">{event.title}</h3><p className="mt-2 text-[9px] text-slate-600">{event.locationName ?? event.region} · {event.automatedConfidence}% confidence · {event.supportingSourceCount} sources</p></Link>)}</div>
        </div>

        <aside className="border-t border-white/[.08] bg-[#0a1118] xl:border-l xl:border-t-0">
          <header className="flex h-14 items-center justify-between border-b border-white/[.08] px-4"><div><p className="text-[9px] uppercase tracking-[.15em] text-red-300/70">Breaking developments</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Alert queue</h2></div><BellRing size={16} className="text-red-300" /></header>
          <div className="divide-y divide-white/[.055]">{runtimeData.alerts.slice(0, 5).map((alert) => <article key={alert.id} className="p-4"><div className="flex items-center justify-between gap-2"><StatusBadge tone={alert.priority === "critical" ? "red" : alert.priority === "high" ? "amber" : "cyan"}>{alert.priority}</StatusBadge><span className="font-mono text-[9px] text-slate-600">{new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}Z</span></div><h3 className="mt-3 text-xs font-semibold text-slate-200">{alert.title}</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">{alert.message}</p><p className="mt-2 text-[9px] text-cyan-300/70" aria-label={`Aether caption: ${alert.voiceMessage}`}>Aether · “{alert.voiceMessage}”</p></article>)}</div>
          <div className="border-t border-white/[.08] p-4"><Link href="/alerts" className="button w-full justify-center">Open alert center</Link></div>
        </aside>
      </section>

      <section className="border-t border-white/[.08] p-3 sm:p-4"><LiveReportStream reports={runtimeData.reports} sources={runtimeData.sources} events={runtimeData.events} compact /></section>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.08] bg-[#080f15] px-4 py-3 text-[9px] uppercase tracking-[.12em] text-slate-600"><span>Latest ingestion {new Date(runtimeData.metrics.lastSuccessfulIngestionAt).toLocaleString()}</span><span>{browserDemoDataEnabled ? "Demonstration snapshot · not real-time intelligence" : "Public information · low confidence until reviewed"} · automated relationships do not establish causation</span></footer>
    </main>
  );
}

function Clock({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[8px] uppercase tracking-[.15em] text-slate-600">{label}</p><p className="mt-1 font-mono text-[11px] text-slate-300">{value}</p></div>;
}
