import { GlobalOperationsView } from "@/components/operations/global-operations-view";
import { demoEvents, demoMetrics, demoReports, demoSources } from "@/packages/shared/demo-data";
import { demoAlerts, demoGraphNodes, demoMarketImpacts, demoRelationships } from "@/packages/shared/operations-demo-data";

export default function CommandCenterPage() {
  return (
    <GlobalOperationsView
      events={demoEvents}
      reports={[...demoReports].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))}
      sources={demoSources}
      relationships={demoRelationships}
      graphNodes={demoGraphNodes}
      marketImpacts={demoMarketImpacts}
      alerts={demoAlerts}
      metrics={demoMetrics}
    />
  );
}
