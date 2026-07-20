import { CommandCenter } from "@/components/dashboard/command-center";
import { demoBriefs, demoEvents, demoMetrics, demoReports } from "@/packages/shared/demo-data";

export default function DashboardPage() {
  return <CommandCenter events={demoEvents} reports={[...demoReports].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))} metrics={demoMetrics} brief={demoBriefs[0]} />;
}
