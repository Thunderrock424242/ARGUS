import Link from "@/components/navigation/link";
import { DemoBanner, PageHeader, primaryButtonClass } from "@/components/domain/argus-ui";
import { EventsExplorer } from "@/components/pages/events-explorer";
import { demoEvents } from "@/packages/shared/demo-data";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";

export default function EventsPage() {
  const runtime = useRuntimeData();
  return (
    <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8">
      <DemoBanner />
      <PageHeader eyebrow="Intelligence registry / 02" title="Events" description="Browse consolidated intelligence records. Source reports are correlated into events while claim-level evidence and analyst verification remain independently visible." actions={<Link className={primaryButtonClass} href="/review">Open review queue <span aria-hidden="true">→</span></Link>} />
      <EventsExplorer events={runtime.events.length || !runtime.demoEnabled ? runtime.events : demoEvents} />
    </main>
  );
}
