import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { IngestionConsole } from "@/components/pages/ingestion-console";
import { CollectorPilotConsole } from "@/components/pages/collector-pilot-console";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";
import { DemoBanner } from "@/components/ui/demo-banner";

export default function IngestionPage() {
  const auth = useAuth();
  const runtime = useRuntimeData();
  const [ingestionRefresh, setIngestionRefresh] = useState(0);
  return (
    <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8">
      <DemoBanner />
      <PageHeader
        eyebrow="Collection control / protected intake"
        title="Ingestion queue"
        description="Normalize incoming evidence, preserve provenance, stop duplicates, and require an explicit reviewer decision before a report enters the ARGUS operating picture."
        actions={<><StatusBadge tone={runtime.source === "d1" ? "green" : "amber"}>{runtime.source === "d1" ? "D1 connected" : "Worker fallback"}</StatusBadge><StatusBadge tone={auth.can("ingestion:review") ? "cyan" : "neutral"}>{auth.can("ingestion:review") ? "Reviewer enabled" : "Role gated"}</StatusBadge></>}
      />
      <CollectorPilotConsole onCollected={() => setIngestionRefresh((value) => value + 1)} />
      <IngestionConsole sources={runtime.sources} events={runtime.events} refreshSignal={ingestionRefresh} />
    </main>
  );
}
