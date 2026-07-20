import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Check, Play, TestTube2, Volume2, VolumeX, X } from "lucide-react";
import { StatusBadge, titleCase } from "@/components/domain/argus-ui";
import { AlertManager } from "@/packages/intelligence/alert-manager";
import { createBrowserVoiceAlertProvider, playArgusSignalTone } from "@/lib/client/voice-alerts";
import type { AlertSettings, IntelligenceAlert } from "@/packages/shared/types";

export function AlertCenter({ alerts, initialSettings }: { alerts: IntelligenceAlert[]; initialSettings: AlertSettings }) {
  const [manager] = useState(() => {
    const value = new AlertManager();
    for (const alert of alerts.filter((item) => item.state === "queued" || item.state === "active")) value.enqueue(alert);
    return value;
  });
  const [snapshot, setSnapshot] = useState(() => manager.snapshot());
  const [settings, setSettings] = useState(initialSettings);
  const [audioReady, setAudioReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("Voice alerts are disabled until the analyst enables ARGUS audio.");
  const [visualTest, setVisualTest] = useState(false);
  const [notificationState, setNotificationState] = useState(() => typeof Notification === "undefined" ? "unavailable" : Notification.permission);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const notifiedAlerts = useRef(new Set<string>());
  const provider = useMemo(() => createBrowserVoiceAlertProvider(), []);

  useEffect(() => {
    const alert = snapshot.active;
    if (
      !alert ||
      !notificationsReady ||
      settings.quietMode ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted" ||
      notifiedAlerts.current.has(alert.id)
    ) return;
    notifiedAlerts.current.add(alert.id);
    const notification = new Notification(`ARGUS · ${alert.title}`, {
      body: alert.message,
      tag: alert.deduplicationKey,
      silent: true,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, [notificationsReady, settings.quietMode, snapshot.active]);

  function refresh() {
    setSnapshot(manager.snapshot());
  }

  async function enableAudio() {
    setAudioReady(true);
    setSettings((current) => ({ ...current, masterAudio: true }));
    setCaption("ARGUS audio enabled. Voice and signal tests require explicit analyst action.");
    try { await playArgusSignalTone(settings.soundVolume); } catch { setCaption("ARGUS audio enabled, but the signal tone is unavailable in this browser."); }
  }

  async function speakNext(customMessage?: string) {
    if (!audioReady || !provider || speaking) return;
    const active = customMessage ? null : manager.next();
    const message = customMessage ?? active?.voiceMessage;
    if (!message) { setCaption("No queued alert is ready for voice playback."); refresh(); return; }
    setSpeaking(true);
    setCaption(message);
    refresh();
    try {
      if (settings.interfaceSounds) await playArgusSignalTone(settings.soundVolume);
      if (settings.voiceAlerts) await provider.speak({ message, priority: active?.priority ?? "normal", eventId: active?.eventId, relationshipId: active?.relationshipId });
    } catch {
      setCaption(`${message} Voice playback was blocked or unavailable; the visual caption remains active.`);
    } finally {
      setSpeaking(false);
    }
  }

  function acknowledge() {
    if (!snapshot.active) return;
    manager.acknowledge(snapshot.active.id);
    setCaption(`${snapshot.active.title} acknowledged.`);
    refresh();
  }

  function dismiss(id: string) {
    manager.dismiss(id);
    refresh();
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") { setNotificationState("unavailable"); return; }
    const result = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    setNotificationState(result);
    setNotificationsReady(result === "granted");
    setCaption(result === "granted"
      ? "Browser notifications enabled for this ARGUS session."
      : "Browser notifications remain disabled; visual in-app alerts stay active.");
  }

  return (
    <div className="space-y-5">
      {visualTest ? <div className="animate-pulse rounded-xl border border-red-300/30 bg-red-300/[.08] p-4 motion-reduce:animate-none" role="alert"><div className="flex items-center gap-3"><Bell size={17} className="text-red-300" /><div><p className="text-xs font-semibold text-red-100">Test visual alert</p><p className="mt-1 text-[10px] text-slate-400">Visual equivalent active. No intelligence event was created.</p></div><button type="button" className="icon-button ml-auto" aria-label="Dismiss test visual alert" onClick={() => setVisualTest(false)}><X size={14} /></button></div></div> : null}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1219]"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] p-4"><div><p className="text-[9px] uppercase tracking-[.15em] text-red-300/70">Meaningful-change queue</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Breaking alerts</h2></div><div className="flex gap-2">{audioReady ? <button type="button" className="button button-primary" disabled={speaking} onClick={() => speakNext()}><Play size={13} /> {speaking ? "Speaking…" : "Play next"}</button> : <button type="button" className="button button-primary" onClick={enableAudio}><Volume2 size={13} /> Enable ARGUS audio</button>}</div></header>
          {snapshot.active ? <article className="border-b border-cyan-300/15 bg-cyan-300/[.035] p-5" role="alert"><div className="flex items-center justify-between gap-3"><StatusBadge tone={snapshot.active.priority === "critical" ? "red" : "amber"}>Active · {snapshot.active.priority}</StatusBadge><span className="font-mono text-[9px] text-slate-600">{new Date(snapshot.active.createdAt).toLocaleString()}</span></div><h3 className="mt-4 text-lg font-semibold text-slate-100">{snapshot.active.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{snapshot.active.message}</p><div className="mt-4 rounded border border-violet-300/15 bg-violet-300/[.035] p-3"><p className="text-[9px] uppercase tracking-[.13em] text-violet-300">Aether caption</p><p className="mt-1 text-xs text-slate-300">“{caption}”</p></div><div className="mt-4 flex gap-2"><button type="button" className="button button-primary" onClick={acknowledge}><Check size={13} /> Acknowledge</button><button type="button" className="button" onClick={() => dismiss(snapshot.active!.id)}><X size={13} /> Dismiss</button></div></article> : null}
          <div className="divide-y divide-white/[.055]">{snapshot.queued.map((alert) => <article key={alert.id} className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"><StatusBadge tone={alert.priority === "critical" ? "red" : alert.priority === "high" ? "amber" : "cyan"}>{alert.priority}</StatusBadge><div><h3 className="text-xs font-semibold text-slate-200">{alert.title}</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">{alert.message}</p><p className="mt-2 text-[9px] text-violet-300/70">Caption · “{alert.voiceMessage}”</p><p className="mt-1 font-mono text-[8px] text-slate-700">Dedup {alert.deduplicationKey} · cooldown {alert.cooldownSeconds}s</p></div><button type="button" className="icon-button" aria-label={`Dismiss ${alert.title}`} onClick={() => dismiss(alert.id)}><X size={13} /></button></article>)}{snapshot.queued.length === 0 && !snapshot.active ? <div className="p-10 text-center text-sm text-slate-600">Alert queue is clear.</div> : null}</div>
        </div>

        <aside className="space-y-4"><section className="rounded-xl border border-white/10 bg-[#0a1219] p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.15em] text-cyan-300/70">Audio boundary</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Voice & notification state</h2></div>{audioReady ? <Volume2 size={17} className="text-cyan-300" /> : <VolumeX size={17} className="text-slate-600" />}</div><dl className="mt-4 grid grid-cols-2 gap-3"><State label="Master audio" value={audioReady ? "Enabled" : "Blocked until interaction"} /><State label="Voice provider" value={provider ? "SpeechSynthesis ready" : "Unavailable"} /><State label="Speech queue" value={speaking ? "Speaking" : "Idle"} /><State label="Notifications" value={notificationsReady ? "Enabled this session" : titleCase(notificationState)} /></dl><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" className="button" disabled={!audioReady || !provider || speaking} onClick={() => speakNext("New signal acquired.")}><TestTube2 size={13} /> Test voice</button><button type="button" className="button" disabled={!audioReady} onClick={() => playArgusSignalTone(settings.soundVolume).catch(() => setCaption("Signal tone unavailable."))}><TestTube2 size={13} /> Test sound</button><button type="button" className="button" onClick={() => setVisualTest(true)}><Bell size={13} /> Test visual</button><button type="button" className="button" disabled={notificationState === "unavailable" || notificationsReady} onClick={requestNotifications}>{notificationState === "denied" ? <BellOff size={13} /> : <Bell size={13} />} {notificationsReady ? "Notifications enabled" : "Enable notifications"}</button></div></section>
          <p className="rounded-lg border border-violet-300/15 bg-violet-300/[.03] p-3 text-[10px] leading-5 text-slate-300" role="status" aria-live="polite"><span className="mr-2 font-semibold uppercase tracking-[.12em] text-violet-300">Aether caption</span>{caption}</p>
          <AlertSettingsPanel settings={settings} update={setSettings} />
        </aside>
      </section>
      <section className="rounded-xl border border-white/10 bg-[#0a1219] p-4"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-500">Alert policy</p><p className="mt-2 text-xs leading-5 text-slate-400">Exact duplicates, syndicated copies, routine refreshes, minor updates, and repeated evidence do not generate voice alerts. The manager serializes speech, prioritizes critical items, applies per-key cooldowns, records acknowledgement, and always provides a visual caption.</p></section>
    </div>
  );
}

function AlertSettingsPanel({ settings, update }: { settings: AlertSettings; update: (value: AlertSettings | ((current: AlertSettings) => AlertSettings)) => void }) {
  return <section className="rounded-xl border border-white/10 bg-[#0a1219] p-4"><p className="text-[9px] uppercase tracking-[.15em] text-cyan-300/70">Analyst controls</p><h2 className="mt-1 text-sm font-semibold text-slate-200">Alert thresholds</h2><div className="mt-4 space-y-4"><Toggle label="Voice alerts" checked={settings.voiceAlerts} onChange={(checked) => update((current) => ({ ...current, voiceAlerts: checked }))} /><Toggle label="Interface sounds" checked={settings.interfaceSounds} onChange={(checked) => update((current) => ({ ...current, interfaceSounds: checked }))} /><Toggle label="Watchlist only" checked={settings.watchlistOnly} onChange={(checked) => update((current) => ({ ...current, watchlistOnly: checked }))} /><Toggle label="Quiet mode" checked={settings.quietMode} onChange={(checked) => update((current) => ({ ...current, quietMode: checked }))} /><Range label="Minimum confidence" value={settings.minimumConfidence} onChange={(value) => update((current) => ({ ...current, minimumConfidence: value }))} /><Range label="Relationship confidence" value={settings.minimumRelationshipConfidence} onChange={(value) => update((current) => ({ ...current, minimumRelationshipConfidence: value }))} /><Range label="Market anomaly" value={settings.minimumMarketAnomaly} onChange={(value) => update((current) => ({ ...current, minimumMarketAnomaly: value }))} /><Range label="Voice volume" value={Math.round(settings.voiceVolume * 100)} onChange={(value) => update((current) => ({ ...current, voiceVolume: value / 100 }))} /></div></section>;
}
function State({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/[.07] p-3"><dt className="text-[8px] uppercase tracking-[.12em] text-slate-600">{label}</dt><dd className="mt-1 text-[10px] leading-4 text-slate-300">{value}</dd></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between gap-3 text-[10px] text-slate-400"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-cyan-300" /></label>; }
function Range({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="block"><span className="flex justify-between text-[9px] text-slate-500"><span>{label}</span><span>{value}%</span></span><input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-cyan-300" /></label>; }
