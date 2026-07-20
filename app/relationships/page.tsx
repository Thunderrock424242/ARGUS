import { DemoBanner } from "@/components/domain/argus-ui";
import { ImpactWorkspace } from "@/components/operations/impact-workspace";
import { demoEvents } from "@/packages/shared/demo-data";
import { demoGraphNodes, demoMarketAssets, demoMarketImpacts, demoRelationshipHistory, demoRelationships } from "@/packages/shared/operations-demo-data";

export default function RelationshipsPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><ImpactWorkspace events={demoEvents} nodes={demoGraphNodes} relationships={demoRelationships} history={demoRelationshipHistory} assets={demoMarketAssets} assessments={demoMarketImpacts} /></main>;
}
