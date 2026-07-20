import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { StatusBadge, titleCase } from "@/components/domain/argus-ui";
import type { IntelligenceEvent, IntelligenceStateChange } from "@/packages/shared/types";

function position(event: IntelligenceEvent) {
  return { left: `${Math.max(2, Math.min(98, (((event.longitude ?? 0) + 180) / 360) * 100))}%`, top: `${Math.max(5, Math.min(93, ((90 - (event.latitude ?? 0)) / 180) * 100))}%` };
}

export function TimelinePlayback({ history, events }: { history: IntelligenceStateChange[]; events: IntelligenceEvent[] }) {
  const sorted = useMemo(() => [...history].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)), [history]);
  const [index, setIndex] = useState(Math.max(0, sorted.length - 1));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showRelationships, setShowRelationships] = useState(true);
  const [showMarkets, setShowMarkets] = useState(true);
  const selected = sorted[index];
  const visible = sorted.slice(0, index + 1).filter((entry) => (showRelationships || !entry.type.startsWith("relationship")) && (showMarkets || entry.type !== "market-assessment-created"));
  const visibleEventIds = new Set(visible.flatMap((entry) => entry.eventId ? [entry.eventId] : []));

  useEffect(() => {
    if (!playing || sorted.length === 0) return;
    const interval = window.setInterval(() => {
      setIndex((current) => {
        if (current >= sorted.length - 1) { setPlaying(false); return current; }
        return current + 1;
      });
    }, Math.max(250, 1_200 / speed));
    return () => window.clearInterval(interval);
  }, [playing, sorted.length, speed]);

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#091119]">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[.08] bg-[#0d161f] p-3"><button type="button" className="icon-button" aria-label={playing ? "Pause timeline" : "Play timeline"} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" className="icon-button" aria-label="Step backward" onClick={() => { setPlaying(false); setIndex((value) => Math.max(0, value - 1)); }}><SkipBack size={15} /></button><button type="button" className="icon-button" aria-label="Step forward" onClick={() => { setPlaying(false); setIndex((value) => Math.min(sorted.length - 1, value + 1)); }}><SkipForward size={15} /></button><button type="button" className="button" onClick={() => { setPlaying(false); setIndex(sorted.length - 1); }}><RotateCcw size={13} /> Live mode</button><label className="flex items-center gap-2 text-[9px] uppercase tracking-[.12em] text-slate-500">Speed<select className="h-8 rounded border border-white/10 bg-[#0a1219] px-2 text-[10px] text-slate-300" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label><label className="ml-auto flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={showRelationships} onChange={(event) => setShowRelationships(event.target.checked)} className="accent-cyan-300" /> Relationships</label><label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={showMarkets} onChange={(event) => setShowMarkets(event.target.checked)} className="accent-cyan-300" /> Markets</label></header>

      <div className="grid min-h-[590px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="relative min-h-[500px] overflow-hidden border-b border-white/[.08] bg-[radial-gradient(circle_at_52%_46%,rgba(14,116,144,.15),transparent_48%),linear-gradient(rgba(65,105,130,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(65,105,130,.08)_1px,transparent_1px)] bg-[size:auto,5%_10%,5%_10%] xl:border-b-0 xl:border-r">
          <div className="absolute inset-[10%_5%_15%] opacity-80" aria-hidden="true"><span className="absolute left-[6%] top-[13%] h-[34%] w-[25%] rotate-[-8deg] rounded-[45%_35%_55%_30%] border border-cyan-300/10 bg-[#14252d]" /><span className="absolute left-[20%] top-[48%] h-[36%] w-[13%] rotate-[9deg] rounded-[40%_55%_50%_60%] border border-cyan-300/10 bg-[#14252d]" /><span className="absolute left-[44%] top-[18%] h-[28%] w-[45%] rounded-[40%_55%_48%_42%] border border-cyan-300/10 bg-[#14252d]" /><span className="absolute left-[47%] top-[41%] h-[36%] w-[16%] rounded-[48%_56%_60%_42%] border border-cyan-300/10 bg-[#14252d]" /></div>
          {events.filter((event) => visibleEventIds.has(event.id)).map((event) => <span key={event.id} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#071019] ${event.severity >= 4 ? "h-4 w-4 bg-red-400 shadow-[0_0_22px_rgba(248,113,113,.75)]" : "h-3 w-3 bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,.65)]"}`} style={position(event)} title={event.title} />)}
          <div className="absolute left-4 top-4 rounded border border-white/10 bg-black/40 px-3 py-2"><p className="text-[8px] uppercase tracking-[.14em] text-slate-600">Selected historical state</p><p className="mt-1 font-mono text-xs text-cyan-200">{selected ? new Date(selected.occurredAt).toLocaleString() : "No history"}</p></div>
          <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-[#081018]/95 p-4 backdrop-blur"><div className="flex items-center justify-between text-[9px] uppercase tracking-[.12em] text-slate-500"><span>{sorted[0] ? new Date(sorted[0].occurredAt).toLocaleString() : "Start"}</span><span className="text-cyan-200">{index + 1}/{sorted.length} changes</span><span>{sorted.at(-1) ? new Date(sorted.at(-1)!.occurredAt).toLocaleString() : "Present"}</span></div><input className="mt-3 w-full accent-cyan-300" type="range" min="0" max={Math.max(0, sorted.length - 1)} value={index} onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }} aria-label="Historical timeline position" /></div>
        </div>
        <aside><header className="border-b border-white/[.08] p-4"><p className="text-[9px] uppercase tracking-[.15em] text-cyan-300/70">Stored state changes</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Playback ledger</h2></header><div className="max-h-[540px] divide-y divide-white/[.055] overflow-y-auto">{visible.slice(-18).reverse().map((entry) => <button key={entry.id} type="button" className={`block w-full p-4 text-left ${entry.id === selected?.id ? "bg-cyan-300/[.05]" : "hover:bg-white/[.02]"}`} onClick={() => { setPlaying(false); setIndex(sorted.findIndex((candidate) => candidate.id === entry.id)); }}><div className="flex items-center justify-between gap-2"><StatusBadge tone={entry.type === "contradiction" ? "red" : entry.type.startsWith("relationship") ? "amber" : entry.type.startsWith("market") ? "violet" : "cyan"}>{titleCase(entry.type)}</StatusBadge><span className="font-mono text-[9px] text-slate-600">{new Date(entry.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}Z</span></div><p className="mt-3 text-xs font-semibold text-slate-200">{entry.title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{entry.description}</p><p className="mt-2 text-[9px] text-slate-600">{titleCase(entry.actor)} · {entry.reportIds.length} evidence record(s)</p></button>)}</div></aside>
      </div>
      <footer className="border-t border-white/[.08] px-4 py-3 text-[9px] leading-4 text-slate-600">Playback reads stored state-change records. It does not reconstruct past state from current events, relationships, or market assessments.</footer>
    </section>
  );
}
