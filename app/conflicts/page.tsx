import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { ConflictRegionalIntelligence } from "@/components/operations/conflict-regional-intelligence";
import { demoEvents } from "@/packages/shared/demo-data";
import { demoConflictProfiles, demoRegionalProfiles, demoRelationships } from "@/packages/shared/operations-demo-data";

export default function ConflictsPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Regional intelligence / ongoing situations" title="Conflict & regional profiles" description="Track fictional ongoing situations, country and regional threat evidence, source-specific estimate ranges, infrastructure effects, collection gaps, and related impact chains." actions={<><StatusBadge tone="amber">{demoConflictProfiles.length} conflict profile</StatusBadge><StatusBadge tone="cyan">{demoRegionalProfiles.length} regional panels</StatusBadge></>} /><ConflictRegionalIntelligence conflicts={demoConflictProfiles} regions={demoRegionalProfiles} events={demoEvents} relationships={demoRelationships} /></main>;
}
