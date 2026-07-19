import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { MapExperience } from "@/components/pages/map-experience";
import { demoEvents } from "@/packages/shared/demo-data";

export default function GlobalMapPage() {
  return (
    <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8">
      <DemoBanner />
      <PageHeader
        eyebrow="Geospatial intelligence / 01"
        title="Global event map"
        description="Explore correlated intelligence events by location, severity, category, confidence, and operational time window. Select any marker to inspect the supporting event record."
        actions={<><StatusBadge tone="green">Feed synchronized</StatusBadge><StatusBadge tone="cyan">24 monitored events</StatusBadge></>}
      />
      <MapExperience events={demoEvents} />
    </main>
  );
}
