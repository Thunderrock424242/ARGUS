import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { TimelinePlayback } from "@/components/operations/timeline-playback";
import { demoEvents } from "@/packages/shared/demo-data";
import { demoStateHistory } from "@/packages/shared/operations-demo-data";

export default function TimelinePage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Historical intelligence / state snapshots" title="Timeline playback" description="Replay stored event, relationship, confidence, contradiction, market, and analyst state changes without reconstructing history from current records." actions={<><StatusBadge tone="green">Stored snapshots</StatusBadge><StatusBadge tone="cyan">{demoStateHistory.length} state changes</StatusBadge></>} /><TimelinePlayback history={demoStateHistory} events={demoEvents} /></main>;
}
