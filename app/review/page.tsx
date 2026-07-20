import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { ReviewQueue } from "@/components/pages/review-queue";
import { demoEvents } from "@/packages/shared/demo-data";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";

export default function ReviewPage() {
  const runtime = useRuntimeData();
  const events = runtime.events.length ? runtime.events : demoEvents;
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Analyst operations / 04" title="Review queue" description="Resolve high-priority verification tasks with durable D1 decisions, optimistic version checks, and append-only audit history." actions={<><StatusBadge tone="amber">{events.filter((event) => event.reviewRequired).length} awaiting review</StatusBadge><StatusBadge tone={runtime.source === "d1" ? "green" : "cyan"}>{runtime.source === "d1" ? "D1 synchronized" : "Fallback ready"}</StatusBadge></>} /><ReviewQueue events={events} /></main>;
}
