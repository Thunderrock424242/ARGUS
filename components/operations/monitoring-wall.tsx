import { useState } from "react";
import { Expand, Grip, Maximize2, Minimize2, RotateCcw, Save } from "lucide-react";
import { StatusBadge, titleCase } from "@/components/domain/argus-ui";
import type { MonitoringLayout, MonitoringWidget } from "@/packages/shared/types";

export function MonitoringWall({ layouts }: { layouts: MonitoringLayout[] }) {
  const original = layouts[0];
  const [widgets, setWidgets] = useState<MonitoringWidget[]>(() => {
    if (typeof window === "undefined") return original?.widgets ?? [];
    const stored = window.localStorage.getItem("argus-monitoring-wall");
    if (!stored) return original?.widgets ?? [];
    try { return JSON.parse(stored) as MonitoringWidget[]; } catch { window.localStorage.removeItem("argus-monitoring-wall"); return original?.widgets ?? []; }
  });
  const [draggedId, setDraggedId] = useState("");
  const [notice, setNotice] = useState("Drag panels to reorder. Layout changes remain local to this browser.");
  const [fullScreen, setFullScreen] = useState(false);

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setWidgets((current) => {
      const next = [...current];
      const from = next.findIndex((widget) => widget.id === draggedId);
      const to = next.findIndex((widget) => widget.id === targetId);
      if (from < 0 || to < 0) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return next.map((widget, index) => ({ ...widget, x: (index % 12), y: Math.floor(index / 3) * 4 }));
    });
    setDraggedId("");
    setNotice("Panel order changed locally. Save the layout to retain it.");
  }

  function resize(id: string, delta: number) {
    setWidgets((current) => current.map((widget) => widget.id === id ? { ...widget, width: Math.max(3, Math.min(12, widget.width + delta)) } : widget));
  }

  function save() {
    window.localStorage.setItem("argus-monitoring-wall", JSON.stringify(widgets));
    setNotice("Monitoring wall saved in local browser storage.");
  }

  function reset() {
    setWidgets(original?.widgets ?? []);
    window.localStorage.removeItem("argus-monitoring-wall");
    setNotice("Monitoring wall restored to the demonstration layout.");
  }

  return (
    <section className={`${fullScreen ? "fixed inset-0 z-[100] overflow-auto bg-[#05090d] p-3" : "rounded-xl border border-white/10 bg-[#070d13]"}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[.08] bg-[#0c141c] p-3"><div className="mr-auto"><p className="text-[9px] uppercase tracking-[.15em] text-cyan-300/70">Multi-monitor workspace</p><h2 className="mt-1 text-sm font-semibold text-slate-200">{original?.name ?? "Monitoring wall"}</h2></div><StatusBadge tone="green">Live mode</StatusBadge><button type="button" className="button" onClick={save}><Save size={13} /> Save layout</button><button type="button" className="button" onClick={reset}><RotateCcw size={13} /> Reset</button><button type="button" className="button" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}{fullScreen ? "Exit operations mode" : "Full-screen operations"}</button></header>
      <div className="grid auto-rows-[70px] grid-cols-1 gap-3 p-3 md:grid-cols-12">{widgets.map((widget) => <article key={widget.id} draggable onDragStart={() => setDraggedId(widget.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(widget.id)} className="group relative min-h-[210px] overflow-hidden rounded-lg border border-white/[.09] bg-[#0b141c] shadow-[0_16px_35px_rgba(0,0,0,.22)]" style={{ gridColumn: `span ${Math.min(12, Math.max(3, widget.width))}`, gridRow: `span ${Math.max(3, widget.height)}` }}><header className="flex h-11 items-center gap-2 border-b border-white/[.07] bg-white/[.015] px-3"><Grip size={13} className="cursor-grab text-slate-600" aria-hidden="true" /><p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">{widget.title}</p><span className="text-[8px] uppercase tracking-[.12em] text-slate-700">{titleCase(widget.type)}</span><button type="button" className="icon-button h-7 w-7" aria-label={`Make ${widget.title} smaller`} onClick={() => resize(widget.id, -1)}><Minimize2 size={11} /></button><button type="button" className="icon-button h-7 w-7" aria-label={`Make ${widget.title} larger`} onClick={() => resize(widget.id, 1)}><Expand size={11} /></button></header><WidgetPreview widget={widget} /></article>)}</div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-white/[.08] px-4 py-3 text-[9px] text-slate-600"><p role="status">{notice}</p><p>Reusable demonstration layout · drag, resize, save, reset</p></footer>
    </section>
  );
}

function WidgetPreview({ widget }: { widget: MonitoringWidget }) {
  if (widget.type === "map") return <div className="relative h-full min-h-[180px] bg-[radial-gradient(circle_at_48%_45%,rgba(8,145,178,.18),transparent_42%),linear-gradient(rgba(103,232,249,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,.06)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px]"><span className="absolute left-[30%] top-[35%] h-3 w-3 rounded-full bg-red-400 shadow-[0_0_20px_rgba(248,113,113,.8)]" /><span className="absolute left-[62%] top-[48%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,.7)]" /><span className="absolute bottom-3 left-3 text-[9px] uppercase tracking-[.12em] text-cyan-200">24 events · global layer stack</span></div>;
  if (widget.type === "alert-stream") return <div className="divide-y divide-white/[.06]"><PreviewRow tone="bg-red-400" title="Priority event detected" meta="S5 · Northstar Arc" /><PreviewRow tone="bg-amber-300" title="Market anomaly detected" meta="AERO-X · 82 score" /><PreviewRow tone="bg-violet-300" title="New relationship detected" meta="Review required" /></div>;
  if (widget.type === "report-feed") return <div className="divide-y divide-white/[.06]"><PreviewRow tone="bg-cyan-300" title="Official bulletin collected" meta="13:15:22Z · processed" /><PreviewRow tone="bg-emerald-300" title="Independent report correlated" meta="13:14:08Z · corroborating" /><PreviewRow tone="bg-red-300" title="Contradiction signal" meta="13:12:41Z · review" /></div>;
  if (widget.type === "impact-graph") return <div className="flex h-full min-h-[180px] items-center justify-center gap-3 p-4"><Node label="Event" tone="border-cyan-300/40" /><span className="text-amber-300">→</span><Node label="Port" tone="border-orange-300/40" /><span className="text-amber-300">→</span><Node label="Freight" tone="border-emerald-300/40" /></div>;
  if (widget.type === "market-chart") return <div className="flex h-full min-h-[180px] items-end gap-2 p-5">{[35, 42, 38, 52, 48, 75, 66, 82].map((height, index) => <span key={index} className={`flex-1 rounded-t ${index >= 5 ? "bg-amber-300/60" : "bg-cyan-300/30"}`} style={{ height: `${height}%` }} />)}</div>;
  if (widget.type === "collector-status") return <div className="grid grid-cols-2 gap-2 p-4">{["RSS", "Hazards", "Cyber", "Weather", "Relief", "Markets"].map((label, index) => <div key={label} className="rounded border border-white/[.07] p-3"><span className={`inline-block h-2 w-2 rounded-full ${index === 4 ? "bg-amber-300" : "bg-emerald-400"}`} /><p className="mt-2 text-[9px] text-slate-400">{label}</p></div>)}</div>;
  return <div className="flex min-h-[180px] items-center justify-center p-5 text-center text-xs text-slate-600">{widget.title} preview</div>;
}
function PreviewRow({ tone, title, meta }: { tone: string; title: string; meta: string }) { return <div className="flex items-center gap-3 p-3"><span className={`h-2 w-2 rounded-full ${tone}`} /><div><p className="text-[10px] font-semibold text-slate-300">{title}</p><p className="mt-1 text-[8px] text-slate-600">{meta}</p></div></div>; }
function Node({ label, tone }: { label: string; tone: string }) { return <span className={`rounded-lg border bg-white/[.02] px-4 py-3 text-[9px] uppercase tracking-[.12em] text-slate-300 ${tone}`}>{label}</span>; }
