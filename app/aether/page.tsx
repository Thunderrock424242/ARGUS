import { Suspense } from "react";
import { AetherConsole } from "@/components/pages/aether-console";
import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { demoEvents, demoReports, demoSources } from "@/packages/shared/demo-data";

export default function AetherPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="AI analysis layer / 07" title="Aether" description="Interrogate stored ARGUS records, compare linked sources, explain confidence factors, surface contradictions, and structure briefs with evidence-bound deterministic responses." actions={<><StatusBadge tone="violet">AI-generated content</StatusBadge><StatusBadge tone="green">No external provider</StatusBadge></>} /><Suspense fallback={<div className="min-h-[720px] rounded-xl border border-white/10 bg-[#0a1219]" aria-label="Loading Aether" />}><AetherConsole events={demoEvents} reports={demoReports} sources={demoSources} /></Suspense></main>;
}
