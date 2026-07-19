import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { ReviewQueue } from "@/components/pages/review-queue";
import { demoEvents } from "@/packages/shared/demo-data";

export default function ReviewPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Analyst operations / 04" title="Review queue" description="Resolve high-priority verification tasks without losing provenance. Decisions in this MVP remain local and create demonstration audit outcomes only." actions={<><StatusBadge tone="amber">{demoEvents.filter((event) => event.reviewRequired).length} awaiting review</StatusBadge><StatusBadge tone="cyan">Keyboard ready</StatusBadge></>} /><ReviewQueue events={demoEvents} /></main>;
}
