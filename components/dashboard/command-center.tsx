import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  FileWarning,
  Radio,
  Server,
  ShieldCheck,
  Signal,
  TriangleAlert,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import type {
  IntelligenceBrief,
  IntelligenceEvent,
  PlatformMetrics,
  SourceReport,
} from "@/packages/shared/types";
import { DemoBanner } from "@/components/ui/demo-banner";
import { CollectionChart } from "./collection-chart";
import { OperationsMap } from "./operations-map";

function relativeTime(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function StatusStrip({ metrics }: { metrics: PlatformMetrics }) {
  const items = [
    ["Active events", metrics.activeEvents, "+3.2%", ""],
    ["Developing", metrics.developingEvents, "+2", "warning"],
    ["Critical", metrics.criticalEvents, "priority", "alert"],
    ["Reports today", metrics.reportsCollectedToday, "+18%", ""],
    ["Awaiting processing", metrics.reportsAwaitingProcessing, "queue", "warning"],
    ["Events for review", metrics.eventsAwaitingReview, "action", "warning"],
    ["Contradictory claims", metrics.contradictoryClaims, "inspect", "alert"],
    ["Sources online", `${metrics.sourcesOnline}/${metrics.sourcesTotal}`, "nominal", ""],
  ] as const;
  return (
    <section className="status-strip" aria-label="Global status metrics">
      {items.map(([label, value, delta, tone]) => (
        <div key={label} className={`status-metric ${tone}`}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{delta}</small>
        </div>
      ))}
    </section>
  );
}

function PriorityIntelligence({ events }: { events: IntelligenceEvent[] }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Priority intelligence</h2>
        <Link href="/events?priority=true" className="panel-action">All priority <ChevronRight size={12} /></Link>
      </header>
      <div className="priority-list">
        {events.slice(0, 6).map((event) => (
          <Link className="priority-item" href={`/events/${event.slug}`} key={event.id}>
            <span className={`severity severity-${event.severity}`}>S{event.severity}</span>
            <div className="priority-main">
              <h3>{event.title}</h3>
              <p>{event.region} · updated {relativeTime(event.lastUpdatedAt)} · {event.supportingSourceCount} supporting sources</p>
              <div className="priority-flags">
                <span className="badge">{event.status}</span>
                {event.officialSourceCount > 0 ? <span className="badge badge-green">official source</span> : null}
                {event.reviewRequired ? <span className="badge badge-amber">review required</span> : null}
              </div>
            </div>
            <div className="priority-confidence">
              <strong>{event.automatedConfidence}%</strong>
              <span>automated</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AetherBrief({ brief }: { brief: IntelligenceBrief }) {
  const points = brief.priorityDevelopments.slice(0, 3);
  return (
    <section className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Aether daily brief</h2>
        <span className="badge badge-violet">AI-generated analysis</span>
      </header>
      <div className="aether-brief-body">
        <div className="aether-signature">
          <span className="aether-glyph"><Bot size={18} /></span>
          <span>
            <strong>Aether assessment</strong>
            <small>Generated {relativeTime(brief.generatedAt)} · deterministic demo</small>
          </span>
        </div>
        <p>{brief.executiveSummary}</p>
        <ul className="brief-points">
          {points.map((point) => <li key={point.eventId}>{point.headline}: {point.assessment}</li>)}
          {brief.collectionGaps[0] ? <li>Verification gap: {brief.collectionGaps[0]}</li> : null}
        </ul>
        <Link className="button button-primary" href={`/briefs/${brief.slug}`}>
          Read full intelligence brief <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}

function RegionalActivity({ metrics }: { metrics: PlatformMetrics }) {
  return (
    <section>
      <div className="panel-header" style={{ paddingInline: 0, borderBottom: 0 }}>
        <h2 className="panel-title">Regional activity</h2>
        <Link href="/map" className="panel-action">Explore map <ChevronRight size={12} /></Link>
      </div>
      <div className="regional-grid">
        {metrics.regionalActivity.map((region) => (
          <article className="region-card" key={region.region}>
            <h3>{region.region}</h3>
            <div className="region-stats">
              <strong>{region.activeEvents}</strong>
              <span>{region.criticalEvents} critical<br />{region.reportsLast24Hours} reports</span>
            </div>
            <span className="region-trend" style={{ width: `${Math.min(100, Math.abs(region.trendPercent) * 7 + 28)}%` }} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportStream({ reports }: { reports: SourceReport[] }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Live report stream</h2>
        <span className="map-live-indicator"><span className="status-dot online" /> ingesting</span>
      </header>
      <div className="report-stream" aria-label="Recently collected reports">
        {reports.slice(0, 10).map((report) => (
          <article className="report-item" key={report.id}>
            <time className="report-time" dateTime={report.collectedAt}>{relativeTime(report.collectedAt)}</time>
            <div className="report-copy">
              <strong>{report.title}</strong>
              <span>{report.sourceId} · {report.category ?? "other"} · {report.countryCode ?? "GLB"}</span>
            </div>
            <span className="processing-state">
              {report.processingStatus === "processed" ? <CheckCircle2 size={11} /> : <Clock3 size={11} />}
              {report.processingStatus}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function SystemHealth({ metrics }: { metrics: PlatformMetrics }) {
  const healthItems = [
    { label: "Collector mesh", value: `${metrics.sourcesOnline}/${metrics.sourcesTotal}`, percent: (metrics.sourcesOnline / metrics.sourcesTotal) * 100, icon: Radio },
    { label: "Database", value: metrics.databaseStatus, percent: metrics.databaseStatus === "operational" ? 99 : 64, icon: Database },
    { label: "Processing worker", value: metrics.workerStatus, percent: metrics.workerStatus === "operational" ? 96 : 62, icon: Server },
    { label: "API response", value: `${metrics.averageApiResponseMs} ms`, percent: Math.max(20, 100 - metrics.averageApiResponseMs / 4), icon: Wifi },
  ];
  return (
    <section className="panel">
      <header className="panel-header">
        <h2 className="panel-title">System health</h2>
        <span className="badge badge-green"><ShieldCheck size={10} /> nominal</span>
      </header>
      <div className="health-list">
        {healthItems.map((item) => (
          <div className="health-row" key={item.label}>
            <header><span><item.icon size={11} /> {item.label}</span></header>
            <span className="health-value">{item.value}</span>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${item.percent}%` }} /></div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 12px 2px" }}>
        <span className="metadata-label">Collection velocity · reports/hour</span>
        <CollectionChart />
      </div>
    </section>
  );
}

export function CommandCenter({
  events,
  reports,
  metrics,
  brief,
}: {
  events: IntelligenceEvent[];
  reports: SourceReport[];
  metrics: PlatformMetrics;
  brief: IntelligenceBrief;
}) {
  const priorityEvents = [...events]
    .filter((event) => event.priority || event.severity >= 4)
    .sort((left, right) => right.severity - left.severity || right.automatedConfidence - left.automatedConfidence);

  return (
    <div className="command-center dashboard-stack">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Global operating picture // UTC continuous</span>
          <h1 className="dashboard-title">Command Center</h1>
          <p className="dashboard-subtitle">Observe, correlate, and assess unfolding situations across the public-information environment.</p>
        </div>
        <div className="toolbar">
          <span className="badge badge-green"><Signal size={10} /> ingestion live</span>
          <span className="badge"><Activity size={10} /> model v1.0-rules</span>
          <Link href="/review" className="button button-primary"><FileWarning size={14} /> Review {metrics.eventsAwaitingReview}</Link>
        </div>
      </header>

      <DemoBanner />
      <StatusStrip metrics={metrics} />

      <div className="dashboard-main-grid">
        <section className="panel">
          <header className="panel-header">
            <h2 className="panel-title">Global situation overview</h2>
            <span className="badge badge-cyan">{events.length} active records</span>
          </header>
          <OperationsMap events={events} />
        </section>
        <PriorityIntelligence events={priorityEvents} />
      </div>

      <RegionalActivity metrics={metrics} />

      <div className="dashboard-lower-grid">
        <AetherBrief brief={brief} />
        <ReportStream reports={reports} />
        <SystemHealth metrics={metrics} />
      </div>

      <footer className="demo-banner">
        <TriangleAlert size={14} />
        <strong>Analytic caution</strong>
        <span>Automated confidence indicates rule satisfaction, not mathematical probability or certainty. Analyst verification is recorded separately.</span>
        {metrics.failedSources > 0 ? <span className="badge badge-red"><CircleAlert size={10} /> {metrics.failedSources} source failures</span> : null}
      </footer>
    </div>
  );
}
