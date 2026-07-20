import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { AlertCenter } from "@/components/operations/alert-center";
import { defaultAlertSettings, demoAlerts } from "@/packages/shared/operations-demo-data";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";

export default function AlertsPage() {
  const runtime = useRuntimeData();
  const alerts = runtime.alerts.length ? runtime.alerts : demoAlerts;
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Breaking intelligence / notification policy" title="Alerts & Aether voice" description="Prioritize meaningful changes, durably record alert actions, serialize voice playback, and keep browser permissions under explicit analyst control." actions={<><StatusBadge tone="amber">{alerts.filter((alert) => alert.state === "queued" || alert.state === "active").length} active</StatusBadge><StatusBadge tone="violet">SpeechSynthesis provider</StatusBadge></>} /><AlertCenter key={`${runtime.source}-${alerts.map((alert) => `${alert.id}:${alert.state}`).join("|")}`} alerts={alerts} initialSettings={defaultAlertSettings} /></main>;
}
