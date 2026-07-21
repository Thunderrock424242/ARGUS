"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, FileInput, RefreshCw, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  PanelHeader,
  StatusBadge,
  buttonClass,
  controlClass,
  formatDate,
  panelClass,
  primaryButtonClass,
  titleCase,
} from "@/components/domain/argus-ui";
import type {
  IngestionSubmission,
  IngestionSubmissionStatus,
  IntelligenceEvent,
  IntelligenceSource,
} from "@/packages/shared/types";

interface IngestionResponse {
  data: IngestionSubmission[];
  meta: { total: number };
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function statusTone(status: IngestionSubmissionStatus): "cyan" | "green" | "amber" | "red" | "violet" {
  if (status === "approved") return "green";
  if (status === "rejected" || status === "failed") return "red";
  if (status === "duplicate") return "violet";
  return "amber";
}

export function IngestionConsole({
  sources,
  events,
}: {
  sources: IntelligenceSource[];
  events: IntelligenceEvent[];
}) {
  const auth = useAuth();
  const [submissions, setSubmissions] = useState<IngestionSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<IngestionSubmissionStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [eventId, setEventId] = useState("");
  const [sourceId, setSourceId] = useState(() => sources.find((source) => source.enabled)?.id ?? "");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [provenanceNotes, setProvenanceNotes] = useState("");

  const enabledSources = useMemo(() => sources.filter((source) => source.enabled), [sources]);
  const selected = submissions.find((submission) => submission.id === selectedId) ?? null;

  useEffect(() => {
    if (auth.status !== "authenticated" || !auth.can("ingestion:read")) return;
    const controller = new AbortController();
    const query = statusFilter === "all" ? "" : `&status=${encodeURIComponent(statusFilter)}`;
    void auth.authenticatedFetch(`/api/admin/ingestion?page=1&limit=100${query}`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response, "The ingestion queue could not be loaded."));
      const payload = await response.json() as IngestionResponse;
      setSubmissions(payload.data);
      setTotal(payload.meta.total);
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "The ingestion queue could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [auth, refreshKey, statusFilter]);

  function refresh() {
    setLoading(true);
    setError(null);
    setRefreshKey((value) => value + 1);
  }

  function selectStatus(status: IngestionSubmissionStatus | "all") {
    setLoading(true);
    setError(null);
    setStatusFilter(status);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const response = await auth.authenticatedFetch("/api/admin/ingestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId,
          url,
          title,
          description: description || undefined,
          publishedAt: new Date(publishedAt).toISOString(),
          provenanceNotes: provenanceNotes || undefined,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The submission could not be ingested."));
      const payload = await response.json() as { data: IngestionSubmission; meta?: { idempotent?: boolean } };
      setNotice(payload.meta?.idempotent
        ? "This exact submission was already recorded; ARGUS returned the existing intake record."
        : payload.data.status === "duplicate"
          ? "The submission matches a canonical report and was retained as a duplicate."
          : "The submission is normalized, hashed, and awaiting reviewer approval.");
      setUrl("");
      setTitle("");
      setDescription("");
      setProvenanceNotes("");
      setPublishedAt(new Date().toISOString().slice(0, 16));
      setStatusFilter("all");
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The submission could not be ingested.");
    } finally {
      setWorking(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!selected || reviewReason.trim().length < 3) {
      setError("Enter a review reason before recording a decision.");
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const response = await auth.authenticatedFetch(`/api/admin/ingestion/${encodeURIComponent(selected.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: reviewReason,
          expectedVersion: selected.recordVersion,
          eventId: eventId || undefined,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The reviewer decision could not be saved."));
      setNotice(decision === "approve"
        ? "Approved: a canonical report is now available to the ARGUS operating picture."
        : "Rejected: the intake record remains in D1 with the reviewer reason and audit trail.");
      setReviewReason("");
      setEventId("");
      setSelectedId(null);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reviewer decision could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  async function retry(submission: IngestionSubmission) {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const response = await auth.authenticatedFetch(`/api/admin/ingestion/${encodeURIComponent(submission.id)}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: "Operator requested retry after inspecting the recorded failure.",
          expectedVersion: submission.recordVersion,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The ingestion retry could not be saved."));
      setNotice("The failed intake record has returned to the review queue with a new attempt entry.");
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The ingestion retry could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  if (auth.status !== "authenticated") {
    return <section className={`${panelClass} p-7 text-center`}><ShieldAlert className="mx-auto text-amber-300" size={28} /><h2 className="mt-4 text-lg font-semibold text-slate-100">Sign in to use ingestion</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">The ingestion queue contains protected provenance and reviewer actions. Use the profile menu to sign in with GitHub.</p></section>;
  }

  if (!auth.can("ingestion:read")) {
    return <section className={`${panelClass} p-7 text-center`}><ShieldAlert className="mx-auto text-amber-300" size={28} /><h2 className="mt-4 text-lg font-semibold text-slate-100">Ingestion role required</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">An administrator must grant Analyst, Reviewer, Source Manager, or Administrator access.</p></section>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.8fr)]">
      <section className={panelClass}>
        <PanelHeader
          eyebrow="Protected D1 queue"
          title={`${total} ingestion submission${total === 1 ? "" : "s"}`}
          action={<button type="button" className={buttonClass} onClick={refresh} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</button>}
        />
        <div className="flex flex-wrap gap-2 border-b border-white/[.06] p-4">
          {(["all", "needs-review", "duplicate", "approved", "rejected", "failed"] as const).map((status) => (
            <button key={status} type="button" className={statusFilter === status ? primaryButtonClass : buttonClass} onClick={() => selectStatus(status)}>{titleCase(status)}</button>
          ))}
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading the durable queue…</p> : null}
        {!loading && submissions.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No submissions match this queue.</p> : null}
        <div className="divide-y divide-white/[.06]">
          {submissions.map((submission) => (
            <article key={submission.id} className={`p-4 transition sm:p-5 ${selectedId === submission.id ? "bg-cyan-300/[.035]" : "hover:bg-white/[.015]"}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={statusTone(submission.status)}>{titleCase(submission.status)}</StatusBadge><span className="font-mono text-[9px] text-slate-600">v{submission.recordVersion} · attempt {submission.attempts}</span></div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-100">{submission.title}</h3>
                  <p className="mt-1 break-all text-[10px] text-cyan-200/70">{submission.normalizedUrl}</p>
                  {submission.description ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{submission.description}</p> : null}
                  <p className="mt-3 text-[10px] text-slate-600">Submitted {formatDate(submission.submittedAt)} by {submission.provenance.submittedByName} · hash {submission.contentHash.slice(0, 12)}</p>
                  {submission.duplicateOfReportId ? <p className="mt-2 text-[10px] text-violet-300">Matches {submission.duplicateOfReportId}</p> : null}
                  {submission.lastError ? <p className="mt-2 rounded border border-red-300/15 bg-red-300/[.04] p-2 text-[10px] text-red-200">{submission.lastError}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {submission.status === "needs-review" && auth.can("ingestion:review") ? <button type="button" className={buttonClass} onClick={() => { setSelectedId(submission.id); setReviewReason(""); setEventId(""); }}>Review</button> : null}
                  {submission.status === "failed" && auth.can("ingestion:retry") ? <button type="button" className={buttonClass} disabled={working} onClick={() => void retry(submission)}><RotateCcw size={13} />Retry</button> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-5">
        {auth.can("ingestion:submit") ? <form className={panelClass} onSubmit={submit}>
          <PanelHeader eyebrow="Validated intake" title="Submit evidence" action={<FileInput size={17} className="text-cyan-300" />} />
          <div className="space-y-4 p-5">
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Registered source</span><select required className={`${controlClass} w-full`} value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{enabledSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Public HTTPS evidence URL</span><input required type="url" className={`${controlClass} w-full`} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.org/report" /></label>
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Report title</span><input required minLength={5} className={`${controlClass} w-full`} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Published at</span><input required type="datetime-local" className={`${controlClass} w-full`} value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} /></label>
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Description</span><textarea className={`${controlClass} min-h-24 w-full py-3`} maxLength={2_000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Provenance notes</span><textarea className={`${controlClass} min-h-20 w-full py-3`} maxLength={2_000} value={provenanceNotes} onChange={(event) => setProvenanceNotes(event.target.value)} placeholder="How this record was obtained and any usage limitations" /></label>
            <p className="text-[10px] leading-5 text-slate-500">ARGUS validates the public URL, normalizes fields, calculates a SHA-256 content hash, checks duplicates, and requires reviewer approval before publication.</p>
            <button type="submit" className={`${primaryButtonClass} w-full`} disabled={working || !sourceId}>{working ? "Submitting…" : "Submit to review queue"}</button>
          </div>
        </form> : null}

        {selected ? <section className={panelClass}>
          <PanelHeader eyebrow="Reviewer decision" title={selected.title} />
          <div className="space-y-4 p-5">
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Link to event (optional)</span><select className={`${controlClass} w-full`} value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">Leave unassociated</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
            <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Decision reason</span><textarea autoFocus required minLength={3} className={`${controlClass} min-h-24 w-full py-3`} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} /></label>
            <div className="grid grid-cols-2 gap-2"><button type="button" className={`${primaryButtonClass} border-emerald-300/25 bg-emerald-300/[.08] text-emerald-100`} disabled={working} onClick={() => void decide("approve")}><Check size={14} />Approve</button><button type="button" className={`${buttonClass} border-red-300/20 text-red-200`} disabled={working} onClick={() => void decide("reject")}><X size={14} />Reject</button></div>
          </div>
        </section> : null}

        {notice ? <p className="rounded-lg border border-emerald-300/15 bg-emerald-300/[.04] p-4 text-xs leading-5 text-emerald-200" role="status">{notice}</p> : null}
        {error ? <p className="rounded-lg border border-red-300/15 bg-red-300/[.04] p-4 text-xs leading-5 text-red-200" role="alert">{error}</p> : null}
      </aside>
    </div>
  );
}
