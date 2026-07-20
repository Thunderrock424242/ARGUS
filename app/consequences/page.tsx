import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { ConsequenceReview } from "@/components/operations/consequence-review";
import { demoGraphNodes, demoRelationships } from "@/packages/shared/operations-demo-data";

export default function ConsequencesPage() {
  const reviewCount = demoRelationships.filter((relationship) => relationship.analystState === "needs-review" || relationship.analystState === "disputed").length;
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Analyst operations / emerging impact" title="Emerging consequences" description="Review automatically proposed downstream effects without promoting correlation or temporal order into confirmed causation." actions={<><StatusBadge tone="amber">{reviewCount} awaiting judgment</StatusBadge><StatusBadge tone="cyan">Evidence linked</StatusBadge></>} /><ConsequenceReview nodes={demoGraphNodes} relationships={demoRelationships} /></main>;
}
