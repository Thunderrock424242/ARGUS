import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { ConsequenceReview } from "@/components/operations/consequence-review";
import { demoGraphNodes, demoRelationships } from "@/packages/shared/operations-demo-data";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";

export default function ConsequencesPage() {
  const runtime = useRuntimeData();
  const relationships = runtime.relationships.length || !runtime.demoEnabled ? runtime.relationships : demoRelationships;
  const nodes = runtime.graphNodes.length || !runtime.demoEnabled ? runtime.graphNodes : demoGraphNodes;
  const reviewCount = relationships.filter((relationship) => relationship.analystState === "needs-review" || relationship.analystState === "disputed").length;
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Analyst operations / emerging impact" title="Emerging consequences" description="Review automatically proposed downstream effects without promoting correlation or temporal order into confirmed causation." actions={<><StatusBadge tone="amber">{reviewCount} awaiting judgment</StatusBadge><StatusBadge tone={runtime.source === "d1" ? "green" : "cyan"}>{runtime.source === "d1" ? "D1 synchronized" : "Evidence linked"}</StatusBadge></>} /><ConsequenceReview nodes={nodes} relationships={relationships} /></main>;
}
