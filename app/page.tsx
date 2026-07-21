import { GlobalOperationsView } from "@/components/operations/global-operations-view";
import { demoEvents, demoMetrics, demoReports, demoSources } from "@/packages/shared/demo-data";
import { demoAlerts, demoGraphNodes, demoMarketImpacts, demoRelationships } from "@/packages/shared/operations-demo-data";
import { browserDemoDataEnabled } from "@/lib/config/demo-mode";

export default function CommandCenterPage() {
  const metrics = browserDemoDataEnabled ? demoMetrics : {
    ...demoMetrics,
    generatedAt: new Date().toISOString(),
    activeEvents: 0,
    developingEvents: 0,
    criticalEvents: 0,
    reportsCollectedToday: 0,
    reportsAwaitingProcessing: 0,
    eventsAwaitingReview: 0,
    contradictoryClaims: 0,
    sourcesOnline: 0,
    sourcesTotal: 0,
    failedSources: 0,
    processingBacklog: 0,
    lastSuccessfulIngestionAt: new Date().toISOString(),
    regionalActivity: [],
    componentHealth: [],
    dataClassification: "public-information" as const,
    demoDataLabel: "Public information workspace",
  };
  return (
    <GlobalOperationsView
      events={browserDemoDataEnabled ? demoEvents : []}
      reports={browserDemoDataEnabled ? [...demoReports].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt)) : []}
      sources={browserDemoDataEnabled ? demoSources : []}
      relationships={browserDemoDataEnabled ? demoRelationships : []}
      graphNodes={browserDemoDataEnabled ? demoGraphNodes : []}
      marketImpacts={browserDemoDataEnabled ? demoMarketImpacts : []}
      alerts={browserDemoDataEnabled ? demoAlerts : []}
      metrics={metrics}
    />
  );
}
