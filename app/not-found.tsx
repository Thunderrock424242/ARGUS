import { DemoBanner } from "@/components/ui/demo-banner";
import { StatePanel } from "@/components/ui/state-panel";

export default function NotFound() {
  return (
    <div className="route-page page-stack">
      <DemoBanner />
      <StatePanel
        type="empty"
        title="Intelligence record not found"
        description="The requested record may have been removed, rejected, merged into another event, or never existed in this demonstration dataset."
        actionHref="/events"
        actionLabel="Browse events"
      />
    </div>
  );
}
