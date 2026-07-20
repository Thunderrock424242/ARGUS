"use client";

import Link from "@/components/navigation/link";
import { useSearchParams } from "@/lib/client/navigation";
import { useMemo, useState } from "react";
import type { AetherResponse, IntelligenceEvent, IntelligenceSource, SourceReport } from "@/packages/shared/types";
import { ConfidenceMeter, StatusBadge, buttonClass, controlClass, formatDate, primaryButtonClass, titleCase } from "@/components/domain/argus-ui";

type Mode = "chat" | "event-context" | "source-comparison" | "brief-generation" | "contradiction-analysis";
type ChatMessage = { id: string; role: "analyst" | "aether"; text: string; eventId?: string; reportIds?: string[] };
type AetherApiPayload = { data?: AetherResponse; error?: { message?: string } };

const brainApiUrl = import.meta.env.VITE_ARGUS_API_URL?.replace(/\/+$/, "") ?? "";

const modes: { id: Mode; label: string; description: string }[] = [
  { id: "chat", label: "General analysis", description: "Query stored ARGUS evidence" },
  { id: "event-context", label: "Event context", description: "Assess one event dossier" },
  { id: "source-comparison", label: "Compare sources", description: "Inspect agreement and provenance" },
  { id: "contradiction-analysis", label: "Contradictions", description: "Surface conflicting claims" },
  { id: "brief-generation", label: "Build a brief", description: "Structure a draft assessment" },
];

const suggestions: Record<Mode, string[]> = {
  chat: ["What changed across priority events?", "Which events have the strongest evidence?", "Where are the current collection gaps?"],
  "event-context": ["Why does this event matter?", "Explain the confidence score.", "What evidence is still missing?"],
  "source-comparison": ["Where do the linked sources agree?", "Are any reports syndicated duplicates?", "Compare source reliability."],
  "contradiction-analysis": ["List the disputed claims.", "Which report introduced the contradiction?", "What would resolve this dispute?"],
  "brief-generation": ["Draft an executive summary.", "Prioritize escalation risks.", "List events requiring review."],
};

export function AetherConsole({ events, reports, sources, initialEventSlug, initialMode }: { events: IntelligenceEvent[]; reports: SourceReport[]; sources: IntelligenceSource[]; initialEventSlug?: string; initialMode?: string }) {
  const searchParams = useSearchParams();
  const eventSlug = initialEventSlug ?? searchParams.get("event") ?? undefined;
  const requestedMode = initialMode ?? searchParams.get("mode") ?? undefined;
  const validMode = modes.some((mode) => mode.id === requestedMode) ? requestedMode as Mode : eventSlug ? "event-context" : "chat";
  const [mode, setMode] = useState<Mode>(validMode);
  const [eventId, setEventId] = useState(events.find((event) => event.slug === eventSlug)?.id ?? events[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "aether", text: "I’m Aether, the ARGUS analysis layer. I can reason only across this stored demonstration dataset. Choose an event or ask a suggested question; every evidence reference will resolve to an existing source report.", eventId }]);
  const [activeMessageId, setActiveMessageId] = useState("welcome");
  const [isThinking, setIsThinking] = useState(false);
  const [brainStatus, setBrainStatus] = useState(
    brainApiUrl ? "Remote ARGUS brain configured." : "Using the bundled demonstration brain.",
  );

  const selectedEvent = events.find((event) => event.id === eventId) ?? events[0];
  const eventReports = useMemo(() => reports.filter((report) => selectedEvent && (report.eventId === selectedEvent.id || selectedEvent.sourceReportIds.includes(report.id))), [reports, selectedEvent]);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const activeMessage = messages.find((message) => message.id === activeMessageId) ?? messages[messages.length - 1];
  const evidenceReports = (activeMessage?.reportIds ?? eventReports.slice(0, 4).map((report) => report.id)).map((id) => reports.find((report) => report.id === id)).filter((report): report is SourceReport => Boolean(report));

  function generateResponse(question: string, id: string): ChatMessage {
    const current = selectedEvent;
    const citations = eventReports.slice(0, 4).map((report) => report.id);
    let text: string;
    if (!current) {
      text = "No event context is available in the demonstration dataset. Choose an event before requesting analysis.";
    } else if (mode === "source-comparison") {
      const named = eventReports.slice(0, 3).map((report) => sourceById.get(report.sourceId)?.name ?? report.sourceId);
      text = `${named.join(", ")} contribute ${eventReports.length} linked reports to “${current.title}.” The evidence aligns on the event’s core time and location, while ${current.contradictionCount} contradiction signal(s) remain open. Syndicated copies are not counted as independent corroboration. Review each cited report before treating the comparison as verified.`;
    } else if (mode === "contradiction-analysis") {
      const disputed = current.disputedClaims[0]?.text ?? "No claim is currently classified as disputed.";
      text = `The primary contradiction is: “${disputed}” ARGUS records ${current.contradictionCount} contradiction signal(s). Resolution would require an independent report with matching time and location, preferably structured or official evidence. Current automated confidence remains ${current.automatedConfidence}%; this score is not a probability.`;
    } else if (mode === "brief-generation") {
      text = `Draft executive line: ${current.summary} This event should be presented as ${titleCase(current.status)} with severity ${current.severity}, ${current.automatedConfidence}% automated confidence, ${current.supportingSourceCount} supporting source(s), and ${current.contradictionCount} unresolved contradiction(s). Analyst verification state: ${titleCase(current.verificationState)}.`;
    } else if (/confidence|score|credible/i.test(question)) {
      const positive = current.confidenceAssessment.positiveFactors.slice(0, 3).map((factor) => factor.label).join(", ");
      const negative = current.confidenceAssessment.negativeFactors.slice(0, 2).map((factor) => factor.label).join(", ") || "no material negative factor";
      text = `ARGUS assigns ${current.automatedConfidence}% automated confidence based on ${positive || "the available corroboration signals"}. Counterweights include ${negative}. This expresses evidence-rule satisfaction under ${current.confidenceAssessment.modelVersion}; it is not a mathematical probability and does not override analyst review.`;
    } else if (/missing|gap|resolve/i.test(question)) {
      text = `${current.title} still needs ${current.officialSourceCount ? "additional independent corroboration" : "an official or structured primary source"}, clearer resolution of ${current.contradictionCount} contradiction(s), and fresh reporting tied to the recorded location. ARGUS should re-run collection before escalating the verification state.`;
    } else if (/why|matter|impact/i.test(question)) {
      text = current.aetherAssessment ?? `${current.title} matters because its severity, regional exposure, and watchlist matches may affect adjacent infrastructure and monitoring priorities. The evidence remains bounded by the cited demonstration reports.`;
    } else {
      text = `${current.title} is currently ${titleCase(current.status)} at severity ${current.severity}, with ${current.automatedConfidence}% automated confidence and ${titleCase(current.verificationState)} analyst status. ${current.summary} The answer is constrained to ${eventReports.length} linked demonstration report(s).`;
    }
    return { id, role: "aether", text, eventId: current.id, reportIds: citations };
  }

  async function generateRemoteResponse(question: string, id: string): Promise<ChatMessage | null> {
    if (!brainApiUrl) return null;
    const response = await fetch(`${brainApiUrl}/api/aether`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: question,
        contextEventIds: selectedEvent ? [selectedEvent.id] : [],
      }),
    });
    const payload = (await response.json()) as AetherApiPayload;
    if (!response.ok || !payload.data) {
      throw new Error(payload.error?.message ?? "The remote ARGUS brain is unavailable.");
    }
    return {
      id,
      role: "aether",
      text: payload.data.answer,
      eventId: payload.data.relatedEventIds[0],
      reportIds: payload.data.citations.map((citation) => citation.reportId),
    };
  }

  async function ask(question = prompt) {
    const clean = question.trim();
    if (!clean || isThinking) return;
    const ordinal = messages.length;
    const analyst: ChatMessage = { id: `analyst-${ordinal}`, role: "analyst", text: clean, eventId };
    const responseId = `aether-${ordinal + 1}`;
    setMessages((current) => [...current, analyst]);
    setPrompt("");
    setIsThinking(true);
    let response: ChatMessage;
    try {
      response =
        (await generateRemoteResponse(clean, responseId)) ??
        generateResponse(clean, responseId);
      setBrainStatus(
        brainApiUrl
          ? "Connected to the remote ARGUS brain."
          : "Using the bundled demonstration brain.",
      );
    } catch {
      response = generateResponse(clean, responseId);
      setBrainStatus("Remote brain unavailable; used the bundled safe fallback.");
    } finally {
      setIsThinking(false);
    }
    setMessages((current) => [...current, response]);
    setActiveMessageId(response.id);
  }

  return (
    <section className="aether-console grid min-h-[720px] overflow-hidden rounded-xl border border-white/10 bg-[#0a1219] xl:grid-cols-[235px_minmax(0,1fr)_330px]">
      <aside className="border-b border-white/[.08] bg-[#0d161f] p-3 xl:border-b-0 xl:border-r">
        <div className="mb-4 rounded-lg border border-violet-300/15 bg-violet-300/[.04] p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/[.07] text-violet-200">Æ</span><div><p className="text-sm font-semibold text-slate-100">Aether</p><p className="text-[9px] uppercase tracking-[.14em] text-violet-300/70">Deterministic analyst</p></div></div></div>
        <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">Analysis mode</p>
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">{modes.map((item) => <button key={item.id} type="button" className={`rounded-md px-3 py-3 text-left transition ${mode === item.id ? "bg-violet-300/[.08] shadow-[inset_3px_0_0_rgba(196,181,253,.65)]" : "hover:bg-white/[.03]"}`} onClick={() => setMode(item.id)}><span className={`block text-xs font-semibold ${mode === item.id ? "text-violet-100" : "text-slate-400"}`}>{item.label}</span><span className="mt-1 block text-[9px] leading-4 text-slate-600">{item.description}</span></button>)}</div>
        <label className="mt-5 block border-t border-white/[.06] px-2 pt-4"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[.15em] text-slate-600">Event context</span><select className={`${controlClass} w-full text-xs`} value={eventId} onChange={(event) => setEventId(event.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
        <div className="mt-5 px-2"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-600">Suggested questions</p><div className="mt-2 space-y-1">{suggestions[mode].map((question) => <button key={question} type="button" className="block min-h-9 w-full rounded px-2 text-left text-[10px] leading-4 text-slate-500 transition hover:bg-white/[.035] hover:text-cyan-200 disabled:cursor-wait disabled:opacity-50" disabled={isThinking} onClick={() => void ask(question)}>{question}</button>)}</div></div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-5 py-3"><div><p className="text-[9px] uppercase tracking-[.14em] text-slate-600">Active context</p><p className="mt-1 max-w-xl truncate text-xs font-semibold text-slate-200">{selectedEvent?.title ?? "No event selected"}</p></div><div className="flex items-center gap-2"><StatusBadge tone="violet">AI-generated</StatusBadge><StatusBadge tone="green">Local evidence only</StatusBadge></div></header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5 lg:p-7" aria-live="polite">{messages.map((message) => <article key={message.id} className={`max-w-[88%] ${message.role === "analyst" ? "ml-auto" : "mr-auto"}`} onClick={() => message.role === "aether" && setActiveMessageId(message.id)}><div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-slate-600"><span>{message.role === "aether" ? "Aether analysis" : "Analyst query"}</span>{message.role === "aether" && <span className="text-violet-300/60">AI-generated</span>}</div><div className={`rounded-xl border p-4 text-sm leading-7 ${message.role === "analyst" ? "border-cyan-300/15 bg-cyan-300/[.055] text-slate-200" : activeMessageId === message.id ? "border-violet-300/20 bg-violet-300/[.05] text-slate-300" : "border-white/[.08] bg-white/[.02] text-slate-300"}`}>{message.text}{message.role === "aether" && message.reportIds && <button type="button" className="mt-4 block text-[10px] font-semibold text-violet-200" onClick={() => setActiveMessageId(message.id)}>{message.reportIds.length} evidence citations →</button>}</div></article>)}</div>
        <form className="border-t border-white/[.08] bg-[#0d161f] p-4" onSubmit={(event) => { event.preventDefault(); void ask(); }}><div className="flex gap-2"><textarea className={`${controlClass} min-h-12 flex-1 resize-none py-3`} rows={1} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={`Ask Aether in ${modes.find((item) => item.id === mode)?.label.toLowerCase()} mode…`} aria-label="Message Aether" /><button type="submit" className={`${primaryButtonClass} self-stretch`} disabled={!prompt.trim() || isThinking}>{isThinking ? "Analyzing…" : "Analyze"} <span aria-hidden="true">↑</span></button></div><p className="mt-2 text-[9px] text-slate-600">{brainStatus} Responses are deterministic and cite only stored demonstration reports.</p></form>
      </div>

      <aside className="border-t border-white/[.08] bg-[#0d161f] xl:border-l xl:border-t-0">
        <div className="border-b border-white/[.08] p-4"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Evidence panel</p><p className="mt-1 text-xs text-slate-300">Citations for selected response</p></div>
        <div className="space-y-5 p-4"><section><ConfidenceMeter score={selectedEvent?.automatedConfidence ?? 0} /><p className="mt-3 text-[10px] leading-4 text-slate-500">{selectedEvent?.confidenceAssessment.explanation ?? "Select an event to inspect confidence."}</p></section><section><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.15em] text-slate-600">Source citations</p><span className="font-mono text-[9px] text-slate-600">{evidenceReports.length}</span></div><div className="mt-3 space-y-2">{evidenceReports.map((report, index) => { const source = sourceById.get(report.sourceId); return <div key={report.id} className="rounded-lg border border-white/[.07] bg-white/[.018] p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] text-violet-300/70">[{index + 1}] {report.id.slice(-6).toUpperCase()}</span><StatusBadge tone={source?.reliabilityScore && source.reliabilityScore >= 85 ? "green" : "cyan"}>{source?.reliabilityScore ?? "—"}/100</StatusBadge></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-300">{report.title}</p><p className="mt-1 text-[9px] text-slate-600">{source?.name ?? report.sourceId} · {formatDate(report.publishedAt)}</p></div>; })}</div></section>{selectedEvent && <Link href={`/events/${selectedEvent.slug}`} className={`${buttonClass} w-full`}>Open evidence dossier →</Link>}<div className="rounded-lg border border-amber-300/10 bg-amber-300/[.025] p-3"><p className="text-[9px] font-bold uppercase tracking-[.13em] text-amber-200/70">Analysis boundary</p><p className="mt-2 text-[10px] leading-4 text-slate-500">Aether cannot browse, infer new sources, or replace analyst verification in this MVP.</p></div></div>
      </aside>
    </section>
  );
}
