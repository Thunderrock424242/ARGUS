import { DemoBanner, PageHeader } from "@/components/domain/argus-ui";
import { SettingsConsole } from "@/components/pages/settings-console";

export default function SettingsPage() { return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Workspace configuration / 09" title="Settings" description="Tune the analyst workspace, notifications, intelligence thresholds, Aether boundaries, security posture, and local data handling." /><SettingsConsole /></main>; }
