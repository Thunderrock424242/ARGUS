import { DemoBanner, MetricCard, PageHeader } from "@/components/domain/argus-ui";
import { SourceManager } from "@/components/pages/source-manager";
import { demoSources } from "@/packages/shared/demo-data";

export default function SourcesPage() {
  const online = demoSources.filter((source) => source.status === "online").length;
  const failures = demoSources.reduce((total, source) => total + source.recentFailureCount, 0);
  const reports = demoSources.reduce((total, source) => total + source.reportsCollected, 0);
  const averageReliability = Math.round(demoSources.reduce((total, source) => total + source.reliabilityScore, 0) / demoSources.length);
  return (
    <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8">
      <DemoBanner />
      <PageHeader eyebrow="Collection network / 03" title="Sources & collectors" description="Manage approved public feeds, inspect provenance and reliability, control schedules, and run safe development adapters without exposing credentials to the browser." />
      <section className="metric-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Sources online" value={`${online}/${demoSources.length}`} detail="Health checks in current snapshot" tone="green" /><MetricCard label="Reports collected" value={reports.toLocaleString()} detail="Across all demonstration collectors" /><MetricCard label="Recent failures" value={failures} detail="Retry policy remains active" tone={failures ? "amber" : "green"} /><MetricCard label="Mean reliability" value={`${averageReliability}/100`} detail="Analyst-configured baseline" /></section>
      <SourceManager initialSources={demoSources} />
    </main>
  );
}
