import type { Metadata } from "next";
import { CommandCenter } from "@/components/dashboard/command-center";
import { demoBriefs, demoEvents, demoMetrics, demoReports } from "@/packages/shared/demo-data";

export const metadata: Metadata = {
  title: "Command Center",
  description: "ARGUS global operating picture and priority intelligence dashboard.",
};

export default function CommandCenterPage() {
  return (
    <CommandCenter
      events={demoEvents}
      reports={[...demoReports].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))}
      metrics={demoMetrics}
      brief={demoBriefs[0]}
    />
  );
}
