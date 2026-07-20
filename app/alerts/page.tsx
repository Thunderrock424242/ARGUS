import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { AlertCenter } from "@/components/operations/alert-center";
import { defaultAlertSettings, demoAlerts } from "@/packages/shared/operations-demo-data";

export default function AlertsPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Breaking intelligence / notification policy" title="Alerts & Aether voice" description="Prioritize meaningful changes, deduplicate event-level alerts, serialize voice playback, retain visual captions, and keep browser permissions under explicit analyst control." actions={<><StatusBadge tone="amber">{demoAlerts.filter((alert) => alert.state === "queued" || alert.state === "active").length} active</StatusBadge><StatusBadge tone="violet">SpeechSynthesis provider</StatusBadge></>} /><AlertCenter alerts={demoAlerts} initialSettings={defaultAlertSettings} /></main>;
}
