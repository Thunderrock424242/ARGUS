import { DemoBanner } from "@/components/domain/argus-ui";
import { ImpactWorkspace } from "@/components/operations/impact-workspace";
import { demoEvents } from "@/packages/shared/demo-data";
import { demoGraphNodes, demoMarketAssets, demoMarketImpacts, demoRelationshipHistory, demoRelationships } from "@/packages/shared/operations-demo-data";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";

export default function RelationshipsPage() {
  const runtime = useRuntimeData();
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><ImpactWorkspace events={runtime.events.length || !runtime.demoEnabled ? runtime.events : demoEvents} nodes={runtime.graphNodes.length || !runtime.demoEnabled ? runtime.graphNodes : demoGraphNodes} relationships={runtime.relationships.length || !runtime.demoEnabled ? runtime.relationships : demoRelationships} history={runtime.relationshipHistory.length || !runtime.demoEnabled ? runtime.relationshipHistory : demoRelationshipHistory} assets={runtime.marketAssets.length || !runtime.demoEnabled ? runtime.marketAssets : demoMarketAssets} assessments={runtime.marketImpacts.length || !runtime.demoEnabled ? runtime.marketImpacts : demoMarketImpacts} /></main>;
}
