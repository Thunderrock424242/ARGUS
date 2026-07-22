import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { OrbitalWatch } from "@/components/orbit/orbital-watch";

export default function OrbitalWatchPage() {
  return (
    <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8">
      <DemoBanner />
      <PageHeader
        eyebrow="Space-domain awareness / 02"
        title="Orbital Watch"
        description="Track source-qualified Earth-orbit objects, NASA/JPL near-Earth approaches, Sentry monitoring records, and NASA space-weather events without confusing propagated or modeled positions for live telemetry."
        actions={<><StatusBadge tone="cyan">3D temporal view</StatusBadge><StatusBadge tone="amber">Not for navigation</StatusBadge></>}
      />
      <OrbitalWatch />
    </main>
  );
}

