import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { MonitoringWall } from "@/components/operations/monitoring-wall";
import { demoMonitoringLayouts } from "@/packages/shared/operations-demo-data";

export default function MonitoringWallPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Operations workspace / configurable displays" title="Monitoring wall" description="Arrange maps, impact graphs, alert streams, market panels, collector health, feeds, and review surfaces into a private, versioned analyst workspace." actions={<StatusBadge tone="green">Owner-aware D1 persistence</StatusBadge>} /><MonitoringWall layouts={demoMonitoringLayouts} /></main>;
}
