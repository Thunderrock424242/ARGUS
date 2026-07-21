"use client";

import { useEffect, useState } from "react";
import { Play, RadioTower, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  PanelHeader,
  StatusBadge,
  buttonClass,
  formatDate,
  panelClass,
  primaryButtonClass,
  titleCase,
} from "@/components/domain/argus-ui";
import type { CollectorRun } from "@/packages/shared/types";

interface CollectorSourceStatus {
  collectorId: string;
  sourceId: string;
  name: string;
  organization: string;
  signalRole: "official" | "news" | "social";
  requestedEnabled: boolean;
  active: boolean;
  credentialRequired: boolean;
  credentialConfigured: boolean;
  disabledReason?: string;
  intervalMinutes: number;
  limitations: string;
  lastRun: CollectorRun | null;
}

interface PilotStatus {
  enabled: boolean;
  schedule: string;
  sources: CollectorSourceStatus[];
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

function runTone(status: CollectorRun["status"] | undefined): "green" | "amber" | "red" | "neutral" {
  if (status === "succeeded") return "green";
  if (status === "partial" || status === "queued" || status === "running") return "amber";
  if (status === "failed" || status === "dead-lettered") return "red";
  return "neutral";
}

export function CollectorPilotConsole({ onCollected }: { onCollected?: () => void }) {
  const auth = useAuth();
  const [status, setStatus] = useState<PilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (auth.status !== "authenticated" || !auth.can("collectors:run")) return;
    const controller = new AbortController();
    void auth.authenticatedFetch("/api/admin/collectors", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "Collector status could not be loaded."));
        const payload = await response.json() as { data: PilotStatus };
        setStatus(payload.data);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Collector status could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [auth, refreshKey]);

  if (auth.status !== "authenticated" || !auth.can("collectors:run")) return null;

  async function run(source: CollectorSourceStatus) {
    setRunningId(source.collectorId);
    setError(null);
    setNotice(null);
    try {
      const response = await auth.authenticatedFetch("/api/admin/collectors/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          collectorId: source.collectorId,
          sourceId: source.sourceId,
          mode: "ingest",
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The collector run could not be completed."));
      const payload = await response.json() as {
        data: { run: CollectorRun; ingestionSubmissionIds: string[] };
      };
      setNotice(
        `${source.name}: ${payload.data.run.reportsInserted} new intake record(s), ${payload.data.run.duplicatesSkipped} duplicate(s), ${payload.data.run.rejectedCount} rejected. Nothing was published automatically.`,
      );
      setRefreshKey((value) => value + 1);
      onCollected?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The collector run could not be completed.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <section className={panelClass}>
      <PanelHeader
        eyebrow="Allowlisted public sources"
        title="Collector pilot"
        action={<button type="button" className={buttonClass} disabled={loading} onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</button>}
      />
      <div className="border-b border-white/[.06] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status?.enabled ? "green" : "amber"}>{status?.enabled ? "Schedule enabled" : "Schedule disabled"}</StatusBadge>
          <span className="text-[10px] text-slate-500">{status?.schedule ?? "Loading collector configuration..."}</span>
        </div>
        <p className="mt-2 text-[10px] leading-5 text-slate-500"><ShieldCheck className="mr-1 inline text-cyan-300" size={12} />Every result enters the protected D1 review queue. X is a social signal and never counts as independent confirmation by itself.</p>
      </div>
      <div className="grid gap-px bg-white/[.06] lg:grid-cols-3">
        {status?.sources.map((source) => (
          <article key={source.collectorId} className="bg-[#0a1118] p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-cyan-300">{titleCase(source.signalRole)} source</p><h3 className="mt-2 text-sm font-semibold text-slate-100">{source.name}</h3><p className="mt-1 text-[10px] text-slate-600">{source.organization}</p></div>
              <RadioTower size={17} className={source.active ? "text-emerald-300" : "text-slate-700"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone={source.active ? "green" : source.requestedEnabled ? "amber" : "neutral"}>{source.active ? "Ready" : source.credentialRequired && !source.credentialConfigured ? "Credential missing" : "Disabled"}</StatusBadge>
              <StatusBadge tone={runTone(source.lastRun?.status)}>{source.lastRun ? titleCase(source.lastRun.status) : "Never run"}</StatusBadge>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">{source.limitations}</p>
            {source.disabledReason ? <p className="mt-2 text-[10px] text-amber-200/80">{source.disabledReason}</p> : null}
            {source.lastRun ? <p className="mt-3 text-[9px] text-slate-600">Last run {formatDate(source.lastRun.startedAt)} · {source.lastRun.reportsInserted} inserted · attempt {source.lastRun.attempt ?? 1}</p> : null}
            <button type="button" className={`${source.active ? primaryButtonClass : buttonClass} mt-4 w-full`} disabled={!source.active || runningId !== null} onClick={() => void run(source)}><Play size={13} />{runningId === source.collectorId ? "Collecting..." : "Collect into review queue"}</button>
          </article>
        ))}
      </div>
      {notice ? <p className="border-t border-emerald-300/15 bg-emerald-300/[.04] p-4 text-xs text-emerald-200" role="status">{notice}</p> : null}
      {error ? <p className="border-t border-red-300/15 bg-red-300/[.04] p-4 text-xs text-red-200" role="alert">{error}</p> : null}
    </section>
  );
}
