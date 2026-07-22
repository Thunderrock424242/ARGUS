"use client";

import {
  AlertTriangle,
  CircleDotDashed,
  Clock3,
  Database,
  ExternalLink,
  Gauge,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Satellite,
  Search,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { controlClass, titleCase } from "@/components/domain/argus-ui";
import { browserDemoDataEnabled } from "@/lib/config/demo-mode";
import { createDemoOrbitalSnapshot } from "@/packages/shared/orbital-demo-data";
import type {
  CloseApproach,
  EarthOrbitObject,
  ImpactRiskRecord,
  OrbitalAttentionState,
  OrbitalMode,
  OrbitalSnapshot,
  SpaceWeatherEvent,
} from "@/packages/shared/orbital-types";
import { OrbitalScene } from "./orbital-scene";

type OrbitalDisplayItem =
  | { kind: "satellite"; id: string; title: string; subtitle: string; attentionState: OrbitalAttentionState; time: string; value: string; record: EarthOrbitObject }
  | { kind: "approach"; id: string; title: string; subtitle: string; attentionState: OrbitalAttentionState; time: string; value: string; record: CloseApproach }
  | { kind: "risk"; id: string; title: string; subtitle: string; attentionState: OrbitalAttentionState; time: string; value: string; record: ImpactRiskRecord }
  | { kind: "weather"; id: string; title: string; subtitle: string; attentionState: OrbitalAttentionState; time: string; value: string; record: SpaceWeatherEvent };

const MODES: Array<{ id: OrbitalMode; label: string; icon: typeof Orbit; description: string }> = [
  { id: "earth-orbit", label: "Earth Orbit", icon: Satellite, description: "Published elements and propagated positions" },
  { id: "near-earth", label: "Near Earth", icon: CircleDotDashed, description: "Close approaches and Sentry monitoring" },
  { id: "solar-activity", label: "Solar Activity", icon: Sun, description: "DONKI observations, analysis, and models" },
];

function initialSnapshot(): OrbitalSnapshot {
  if (browserDemoDataEnabled) return createDemoOrbitalSnapshot();
  return {
    generatedAt: new Date().toISOString(),
    dataClassification: "public-information",
    demoDataLabel: "No orbital source snapshot available — demonstration fallback disabled",
    earthOrbitObjects: [],
    closeApproaches: [],
    impactRisks: [],
    spaceWeatherEvents: [],
    sources: [],
  };
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp)).replace(",", "") + " UTC";
}

function attentionLabel(value: OrbitalAttentionState): string {
  if (value === "information") return "Info";
  return titleCase(value);
}

function displayItems(snapshot: OrbitalSnapshot, mode: OrbitalMode): OrbitalDisplayItem[] {
  if (mode === "earth-orbit") {
    return snapshot.earthOrbitObjects.map((record) => ({
      kind: "satellite",
      id: record.id,
      title: record.name,
      subtitle: `NORAD ${record.noradCatalogId} · ${record.orbitClass}`,
      attentionState: record.attentionState,
      time: record.elementEpoch,
      value: record.objectType,
      record,
    }));
  }
  if (mode === "near-earth") {
    return [
      ...snapshot.closeApproaches.map((record): OrbitalDisplayItem => ({
        kind: "approach",
        id: record.id,
        title: record.fullName,
        subtitle: `${record.nominalDistanceLunar.toFixed(2)} LD · ${record.relativeVelocityKmS.toFixed(1)} km/s`,
        attentionState: record.attentionState,
        time: record.closeApproachTime,
        value: "close approach",
        record,
      })),
      ...snapshot.impactRisks.map((record): OrbitalDisplayItem => ({
        kind: "risk",
        id: record.id,
        title: `Sentry · ${record.fullName}`,
        subtitle: `Torino ${record.maximumTorino} · Palermo ${record.cumulativePalermo.toFixed(2)}`,
        attentionState: record.attentionState,
        time: record.lastObservationDate ?? "Observation date unavailable",
        value: "impact monitoring",
        record,
      })),
    ];
  }
  return snapshot.spaceWeatherEvents.map((record) => ({
    kind: "weather",
    id: record.id,
    title: record.title,
    subtitle: [titleCase(record.type), record.classType, record.speedKmS ? `${record.speedKmS} km/s` : undefined].filter(Boolean).join(" · "),
    attentionState: record.attentionState,
    time: record.startedAt,
    value: record.type,
    record,
  }));
}

function DetailValue({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="orbital-detail-value">
      <span>{label}</span>
      <strong>{value ?? "Not supplied"}</strong>
    </div>
  );
}

function SelectedDetails({ item }: { item: OrbitalDisplayItem | undefined }) {
  if (!item) return <div className="orbital-empty-detail">No object matches the current filters.</div>;
  const common = (
    <>
      <div className="orbital-detail-heading">
        <span className={`orbital-attention attention-${item.attentionState}`}>{attentionLabel(item.attentionState)}</span>
        <span>{titleCase(item.kind)}</span>
      </div>
      <h2>{item.title}</h2>
      <p>{item.record.attentionReason}</p>
    </>
  );
  if (item.kind === "satellite") {
    const record = item.record;
    return <>{common}<div className="orbital-detail-grid"><DetailValue label="NORAD catalog" value={record.noradCatalogId} /><DetailValue label="Orbit class" value={record.orbitClass} /><DetailValue label="Object type" value={titleCase(record.objectType)} /><DetailValue label="Element epoch" value={formatDate(record.elementEpoch)} /><DetailValue label="Mean motion" value={`${Number(record.elements.MEAN_MOTION).toFixed(4)} rev/day`} /><DetailValue label="Inclination" value={`${Number(record.elements.INCLINATION).toFixed(2)}°`} /></div><a className="button orbital-source-link" href={record.sourceUrl} target="_blank" rel="noreferrer">Open source record <ExternalLink size={12} /></a></>;
  }
  if (item.kind === "approach") {
    const record = item.record;
    return <>{common}<div className="orbital-detail-grid"><DetailValue label="Designation" value={record.designation} /><DetailValue label="Approach time" value={`${formatDate(record.closeApproachTime)} (${record.timeSystem})`} /><DetailValue label="Nominal distance" value={`${record.nominalDistanceLunar.toFixed(2)} LD`} /><DetailValue label="Minimum 3σ" value={`${record.minimumDistanceAu.toFixed(6)} au`} /><DetailValue label="Relative velocity" value={`${record.relativeVelocityKmS.toFixed(2)} km/s`} /><DetailValue label="Diameter" value={record.diameterKm ? `${(record.diameterKm * 1_000).toFixed(0)} m` : undefined} /></div><a className="button orbital-source-link" href={record.sourceUrl} target="_blank" rel="noreferrer">Open JPL record <ExternalLink size={12} /></a></>;
  }
  if (item.kind === "risk") {
    const record = item.record;
    return <>{common}<div className="orbital-caution"><AlertTriangle size={14} /> A Sentry listing is a probabilistic monitoring result, not an expected impact.</div><div className="orbital-detail-grid"><DetailValue label="Impact probability" value={record.impactProbability.toExponential(3)} /><DetailValue label="Potential solutions" value={record.potentialImpactCount} /><DetailValue label="Maximum Torino" value={record.maximumTorino} /><DetailValue label="Cumulative Palermo" value={record.cumulativePalermo.toFixed(2)} /><DetailValue label="Potential range" value={record.potentialImpactRange} /><DetailValue label="Last observation" value={record.lastObservationDate} /></div><a className="button orbital-source-link" href={record.sourceUrl} target="_blank" rel="noreferrer">Open Sentry record <ExternalLink size={12} /></a></>;
  }
  const record = item.record;
  return <>{common}<div className="orbital-detail-grid"><DetailValue label="Event type" value={titleCase(record.type)} /><DetailValue label="Started" value={formatDate(record.startedAt)} /><DetailValue label="Class" value={record.classType} /><DetailValue label="Speed" value={record.speedKmS ? `${record.speedKmS} km/s` : undefined} /><DetailValue label="Source location" value={record.sourceLocation} /><DetailValue label="Linked events" value={record.linkedEventIds.length} /></div><a className="button orbital-source-link" href={record.sourceUrl} target="_blank" rel="noreferrer">Open DONKI record <ExternalLink size={12} /></a></>;
}

export function OrbitalWatch() {
  const auth = useAuth();
  const [snapshot, setSnapshot] = useState<OrbitalSnapshot>(initialSnapshot);
  const [runtimeState, setRuntimeState] = useState<"syncing" | "worker" | "fallback">("syncing");
  const [mode, setMode] = useState<OrbitalMode>("earth-orbit");
  const [query, setQuery] = useState("");
  const [attention, setAttention] = useState<"all" | OrbitalAttentionState>("all");
  const [selectedId, setSelectedId] = useState("");
  const [simulationTime, setSimulationTime] = useState(() => Date.now());
  const [timeReference, setTimeReference] = useState(() => Date.now());
  const [playing, setPlaying] = useState(true);
  const [timeRate, setTimeRate] = useState(60);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void auth.publicFetch("/api/orbit", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Orbital snapshot request was rejected.");
        const payload = await response.json() as { data: OrbitalSnapshot };
        if (active) {
          setSnapshot(payload.data);
          setRuntimeState("worker");
        }
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setRuntimeState("fallback");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [auth]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setTimeReference(Date.now());
      setSimulationTime((value) => value + timeRate * 5_000);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [playing, timeRate]);

  const items = useMemo(() => displayItems(snapshot, mode), [mode, snapshot]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-US");
    return items.filter((item) => {
      const matchesAttention = attention === "all" || item.attentionState === attention;
      const matchesQuery = !term || `${item.title} ${item.subtitle} ${item.value}`.toLocaleLowerCase("en-US").includes(term);
      return matchesAttention && matchesQuery;
    });
  }, [attention, items, query]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const selectObject = useCallback((id: string) => setSelectedId(id), []);
  const watchCount = items.filter((item) => item.attentionState === "watch" || item.attentionState === "elevated").length;

  return (
    <section className="orbital-workspace">
      <div className="orbital-modebar" aria-label="Orbital Watch modes">
        <div className="orbital-mode-tabs">
          {MODES.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)} aria-pressed={mode === item.id}><Icon size={15} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>;
          })}
        </div>
        <div className={`orbital-runtime runtime-${runtimeState}`}><span />{runtimeState === "syncing" ? "Synchronizing" : runtimeState === "worker" ? "Worker snapshot" : "Fixture fallback"}</div>
      </div>

      <div className="orbital-summarybar">
        <span><Database size={12} /> {snapshot.sources.filter((source) => source.status === "online").length}/{snapshot.sources.length} live sources</span>
        <span><Orbit size={12} /> {items.length} records in mode</span>
        <span><Gauge size={12} /> {watchCount} attention records</span>
        <span className="orbital-classification">{snapshot.dataClassification}</span>
      </div>

      <div className="orbital-main-grid">
        <aside className="orbital-object-panel" aria-label="Tracked objects and events">
          <div className="orbital-panel-controls">
            <label className="orbital-search"><Search size={13} /><span className="sr-only">Search orbital records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search object or ID" /></label>
            <select className={controlClass} value={attention} onChange={(event) => setAttention(event.target.value as typeof attention)} aria-label="Filter by attention state">
              <option value="all">All attention states</option>
              <option value="information">Information</option>
              <option value="watch">Watch</option>
              <option value="elevated">Elevated</option>
              <option value="stale">Stale</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="orbital-object-list">
            {filtered.map((item) => <button key={item.id} type="button" className={selected?.id === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}><span className={`orbital-object-mark mark-${item.attentionState}`} /><span className="orbital-object-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className={`orbital-attention attention-${item.attentionState}`}>{attentionLabel(item.attentionState)}</span></button>)}
            {!filtered.length ? <div className="orbital-list-empty">No records match these filters.</div> : null}
          </div>
        </aside>

        <div className="orbital-visual-panel">
          <OrbitalScene mode={mode} snapshot={snapshot} selectedId={selected?.id ?? ""} simulationTime={Math.floor(simulationTime / 60_000) * 60_000} onSelect={selectObject} />
          <div className="orbital-timebar">
            <button type="button" className="icon-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause orbital time" : "Play orbital time"}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
            <div><Clock3 size={13} /><strong>{formatDate(new Date(simulationTime).toISOString())}</strong><span>{timeRate === 1 ? "real time" : `${timeRate}× simulation`}</span></div>
            <input type="range" min={-24} max={168} step={1} value={Math.max(-24, Math.min(168, Math.round((simulationTime - timeReference) / 3_600_000)))} onChange={(event) => { const now = Date.now(); setPlaying(false); setTimeReference(now); setSimulationTime(now + Number(event.target.value) * 3_600_000); }} aria-label="Orbital time offset in hours" />
            <select value={timeRate} onChange={(event) => setTimeRate(Number(event.target.value))} aria-label="Orbital playback rate"><option value="1">1×</option><option value="60">60×</option><option value="600">600×</option></select>
            <button type="button" className="button" onClick={() => { const now = Date.now(); setTimeReference(now); setSimulationTime(now); setPlaying(true); }}><RotateCcw size={12} /> Now</button>
          </div>
        </div>

        <aside className="orbital-detail-panel" aria-live="polite">
          <SelectedDetails item={selected} />
          <div className="orbital-provenance"><strong>Source boundary</strong><span>{snapshot.demoDataLabel}</span><span>Visualization is not for navigation, conjunction assessment, or emergency warning.</span></div>
        </aside>
      </div>

      <div className="orbital-source-health">
        <div className="orbital-section-title"><Database size={14} /><span><strong>Source health</strong><small>Browser reads only ARGUS snapshots; external APIs are contacted by the Worker.</small></span></div>
        <div className="orbital-source-grid">
          {snapshot.sources.map((source) => <a key={source.id} href={source.sourceUrl} target="_blank" rel="noreferrer"><span className={`source-health-dot health-${source.status}`} /><span><strong>{source.name}</strong><small>{source.message}</small></span><span className="orbital-source-meta">{source.recordCount} records{source.lastSuccessfulAt ? ` · ${formatDate(source.lastSuccessfulAt)}` : ""}</span></a>)}
          {!snapshot.sources.length ? <div className="orbital-source-empty">No Worker source snapshot is available. Live synchronization and demonstration fallback are both disabled.</div> : null}
        </div>
      </div>

      <div className="orbital-table-wrap">
        <div className="orbital-section-title"><Orbit size={14} /><span><strong>Accessible synchronized record table</strong><small>Equivalent information remains available without the WebGL scene.</small></span></div>
        <div className="table-scroll"><table className="data-table orbital-table"><thead><tr><th>Record</th><th>Kind</th><th>State</th><th>Source time</th><th>Key value</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><button type="button" onClick={() => setSelectedId(item.id)}>{item.title}</button><small>{item.subtitle}</small></td><td>{titleCase(item.kind)}</td><td><span className={`orbital-attention attention-${item.attentionState}`}>{attentionLabel(item.attentionState)}</span></td><td>{formatDate(item.time)}</td><td>{titleCase(item.value)}</td></tr>)}</tbody></table></div>
      </div>
    </section>
  );
}
