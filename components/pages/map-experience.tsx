"use client";

import Link from "@/components/navigation/link";
import { useMemo, useState } from "react";
import type { IntelligenceEvent } from "@/packages/shared/types";
import { ConfidenceMeter, SeverityMark, StatusBadge, controlClass, titleCase } from "@/components/domain/argus-ui";

const categories = ["all", "conflict", "cyber", "disaster", "maritime", "aviation", "health", "infrastructure", "political"];

function coordinateToPosition(latitude = 0, longitude = 0) {
  return {
    left: `${Math.max(2, Math.min(98, ((longitude + 180) / 360) * 100))}%`,
    top: `${Math.max(5, Math.min(93, ((90 - latitude) / 180) * 100))}%`,
  };
}

export function MapExperience({ events }: { events: IntelligenceEvent[] }) {
  const [category, setCategory] = useState("all");
  const [minimumSeverity, setMinimumSeverity] = useState(1);
  const [minimumConfidence, setMinimumConfidence] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");
  const [showHeat, setShowHeat] = useState(true);
  const [timeWindow, setTimeWindow] = useState(72);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesCategory = category === "all" || event.category === category;
      const matchesSeverity = event.severity >= minimumSeverity;
      const matchesConfidence = event.automatedConfidence >= minimumConfidence;
      const searchable = `${event.title} ${event.locationName ?? ""} ${event.countryName ?? ""} ${event.region ?? ""}`.toLowerCase();
      return matchesCategory && matchesSeverity && matchesConfidence && (!term || searchable.includes(term));
    });
  }, [category, events, minimumConfidence, minimumSeverity, query]);

  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0];

  return (
    <div className="map-workspace overflow-hidden rounded-xl border border-white/10 bg-[#070d13] shadow-[0_24px_70px_rgba(0,0,0,.34)]">
      <div className="map-toolbar grid gap-3 border-b border-white/[.08] bg-[#101820]/95 p-3 lg:grid-cols-[minmax(200px,1.2fr)_repeat(4,minmax(120px,.6fr))]">
        <label className="relative">
          <span className="sr-only">Search map</span>
          <input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search place, event, or coordinates" />
          <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500" aria-hidden="true">⌕</span>
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select className={`${controlClass} w-full`} value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item} value={item}>{item === "all" ? "All categories" : titleCase(item)}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Minimum severity</span>
          <select className={`${controlClass} w-full`} value={minimumSeverity} onChange={(event) => setMinimumSeverity(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>Severity {value}+</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Minimum confidence</span>
          <select className={`${controlClass} w-full`} value={minimumConfidence} onChange={(event) => setMinimumConfidence(Number(event.target.value))}>
            {[0, 50, 70, 90].map((value) => <option key={value} value={value}>{value ? `${value}%+ confidence` : "Any confidence"}</option>)}
          </select>
        </label>
        <button className={`${controlClass} flex items-center justify-between`} type="button" aria-pressed={showHeat} onClick={() => setShowHeat((value) => !value)}>
          <span>Activity overlay</span><span className={`h-2 w-2 rounded-full ${showHeat ? "bg-cyan-300" : "bg-slate-600"}`} />
        </button>
      </div>

      <div className="map-layout grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="relative min-h-[520px] overflow-hidden border-b border-white/[.08] xl:border-b-0 xl:border-r">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(65,105,130,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(65,105,130,.09)_1px,transparent_1px)] bg-[size:5%_10%]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_46%,rgba(18,102,125,.15),transparent_45%)]" />
          <div className="map-land absolute inset-[8%_3%_11%] opacity-90" aria-hidden="true">
            <span className="absolute left-[6%] top-[15%] h-[31%] w-[26%] rotate-[-8deg] rounded-[45%_35%_55%_30%] border border-cyan-300/10 bg-[#14252d]" />
            <span className="absolute left-[20%] top-[49%] h-[36%] w-[13%] rotate-[9deg] rounded-[40%_55%_50%_60%] border border-cyan-300/10 bg-[#14252d]" />
            <span className="absolute left-[43%] top-[19%] h-[26%] w-[17%] rounded-[46%_54%_38%_60%] border border-cyan-300/10 bg-[#14252d]" />
            <span className="absolute left-[45%] top-[39%] h-[38%] w-[17%] rotate-[-5deg] rounded-[48%_56%_60%_42%] border border-cyan-300/10 bg-[#14252d]" />
            <span className="absolute left-[57%] top-[15%] h-[36%] w-[31%] rotate-[2deg] rounded-[35%_55%_50%_44%] border border-cyan-300/10 bg-[#14252d]" />
            <span className="absolute left-[78%] top-[58%] h-[18%] w-[13%] rotate-[8deg] rounded-[50%_40%_55%_42%] border border-cyan-300/10 bg-[#14252d]" />
          </div>

          {showHeat && filtered.map((event) => {
            const position = coordinateToPosition(event.latitude, event.longitude);
            return <span key={`heat-${event.id}`} className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl ${event.severity >= 4 ? "h-20 w-20 bg-red-500/10" : "h-14 w-14 bg-cyan-400/[.08]"}`} style={position} />;
          })}

          {filtered.map((event) => {
            const position = coordinateToPosition(event.latitude, event.longitude);
            const isSelected = selected?.id === event.id;
            return (
              <button
                key={event.id}
                type="button"
                className={`map-marker group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${event.status === "developing" || event.status === "emerging" ? "animate-pulse" : ""}`}
                style={position}
                aria-label={`${event.title}, severity ${event.severity}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(event.id)}
              >
                <span className={`block rounded-full border-2 border-[#071019] ${isSelected ? "h-5 w-5 bg-white shadow-[0_0_0_6px_rgba(103,232,249,.15),0_0_24px_rgba(103,232,249,.8)]" : event.severity >= 5 ? "h-4 w-4 bg-red-400 shadow-[0_0_18px_rgba(248,113,113,.75)]" : event.severity === 4 ? "h-4 w-4 bg-orange-400 shadow-[0_0_16px_rgba(251,146,60,.65)]" : "h-3.5 w-3.5 bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.55)]"}`} />
              </button>
            );
          })}

          <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/10 bg-[#091119]/90 px-4 py-3 backdrop-blur md:left-1/2 md:w-[min(680px,calc(100%-2rem))] md:-translate-x-1/2">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Playback</span>
              <input className="w-full accent-cyan-300" type="range" min="6" max="168" step="6" value={timeWindow} onChange={(event) => setTimeWindow(Number(event.target.value))} aria-label="Map time window in hours" />
              <span className="w-16 text-right font-mono text-[10px] text-cyan-200">−{timeWindow}H</span>
            </div>
          </div>
          <div className="absolute left-4 top-4 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">
            <span className="rounded border border-white/10 bg-black/35 px-2 py-1">{filtered.length} visible</span>
            <span className="rounded border border-white/10 bg-black/35 px-2 py-1">UTC live view</span>
          </div>
        </div>

        <aside className="map-drawer bg-[#0c141c]" aria-live="polite">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-white/[.08] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <SeverityMark severity={selected.severity} />
                  <StatusBadge tone={selected.verificationState === "analyst-confirmed" ? "green" : selected.verificationState === "disputed" ? "red" : "amber"}>{titleCase(selected.verificationState)}</StatusBadge>
                </div>
                <h2 className="text-lg font-semibold leading-7 text-slate-50">{selected.title}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">{selected.summary}</p>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">{selected.locationName ?? selected.countryName ?? "Location under assessment"} · {selected.region ?? "Global"}</p>
              </div>
              <div className="flex-1 space-y-5 p-5">
                <ConfidenceMeter score={selected.automatedConfidence} />
                <dl className="grid grid-cols-2 gap-4">
                  <div><dt className="text-[9px] uppercase tracking-[.14em] text-slate-500">Category</dt><dd className="mt-1 text-xs text-slate-200">{titleCase(selected.category)}</dd></div>
                  <div><dt className="text-[9px] uppercase tracking-[.14em] text-slate-500">Status</dt><dd className="mt-1 text-xs text-slate-200">{titleCase(selected.status)}</dd></div>
                  <div><dt className="text-[9px] uppercase tracking-[.14em] text-slate-500">Sources</dt><dd className="mt-1 text-xs text-slate-200">{selected.sourceReportIds.length} linked reports</dd></div>
                  <div><dt className="text-[9px] uppercase tracking-[.14em] text-slate-500">Coordinates</dt><dd className="mt-1 font-mono text-[10px] text-slate-200">{selected.latitude?.toFixed(2)}, {selected.longitude?.toFixed(2)}</dd></div>
                </dl>
                <div className="rounded-lg border border-cyan-300/10 bg-cyan-300/[.04] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-[.15em] text-cyan-200/70">Why it matters</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{selected.aetherAssessment ?? "Aether is tracking corroboration, regional exposure, and potential escalation indicators for this event."}</p>
                </div>
              </div>
              <div className="border-t border-white/[.08] p-4">
                <Link className="flex min-h-11 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60" href={`/events/${selected.slug}`}>Open intelligence dossier →</Link>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">No events match the current filters.</div>
          )}
        </aside>
      </div>

      <div className="map-legend flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[.08] bg-[#0a1118] px-4 py-3 text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">
        <span className="text-slate-300">Map legend</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-red-400" /> Critical</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-orange-400" /> High</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-300" /> Monitored</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full border border-cyan-200 bg-white" /> Selected</span>
        <span className="ml-auto">Equirectangular operational overview · not for navigation</span>
      </div>
    </div>
  );
}
