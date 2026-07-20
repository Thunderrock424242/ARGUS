import Link from "@/components/navigation/link";
import NotFound from "@/app/not-found";
import { DemoBanner, PageHeader, SeverityMark, StatusBadge, buttonClass, primaryButtonClass, titleCase } from "@/components/domain/argus-ui";
import { EventDossier } from "@/components/pages/event-dossier";
import { demoAuditEntries, demoEvents, demoReports, demoSources, demoTimelineEntries } from "@/packages/shared/demo-data";
import { demoGraphNodes, demoMarketAssets, demoMarketImpacts, demoRelationships } from "@/packages/shared/operations-demo-data";
import { useRuntimeData } from "@/components/runtime/runtime-data-provider";

export default function EventDossierPage({ slug }: { slug: string }) {
  const runtime = useRuntimeData();
  const events = runtime.events.length ? runtime.events : demoEvents;
  const event = events.find((item) => item.slug === slug);
  if (!event) return <NotFound />;

  const reports = (runtime.reports.length ? runtime.reports : demoReports).filter((report) => event.sourceReportIds.includes(report.id) || report.eventId === event.id);
  const relatedEvents = events.filter((candidate) => event.relatedEventIds.includes(candidate.id));
  const timeline = (runtime.timelineEntries.length ? runtime.timelineEntries : demoTimelineEntries).filter((entry) => entry.eventId === event.id).sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const auditEntries = runtime.auditEntries.length ? runtime.auditEntries : demoAuditEntries;
  const audit = auditEntries.filter((entry) => entry.targetId === event.id || event.confirmedFacts.some((claim) => claim.id === entry.targetId));
  const graphNodes = runtime.graphNodes.length ? runtime.graphNodes : demoGraphNodes;
  const relationships = runtime.relationships.length ? runtime.relationships : demoRelationships;
  const eventNode = graphNodes.find((node) => node.type === "event" && node.eventId === event.id);
  const impactRelationships = eventNode ? relationships.filter((relationship) => relationship.sourceNodeId === eventNode.id || relationship.targetNodeId === eventNode.id) : [];
  const marketImpacts = (runtime.marketImpacts.length ? runtime.marketImpacts : demoMarketImpacts).filter((assessment) => assessment.eventId === event.id);

  return (
    <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8">
      <DemoBanner />
      <div><Link href="/events" className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-500 transition hover:text-cyan-200">← Back to event registry</Link></div>
      <PageHeader
        eyebrow={`Intelligence dossier / ${event.id.toUpperCase()}`}
        title={event.title}
        description={`${event.locationName ?? event.countryName ?? "Location pending"} · ${titleCase(event.category)} · First detected ${new Date(event.firstDetectedAt).toLocaleDateString("en", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })}`}
        actions={<><SeverityMark severity={event.severity} /><StatusBadge tone={event.verificationState === "analyst-confirmed" ? "green" : event.verificationState === "disputed" ? "red" : "amber"}>{titleCase(event.verificationState)}</StatusBadge><Link href="/review" className={buttonClass}>Review event</Link><Link href={`/aether?event=${event.slug}`} className={primaryButtonClass}>Ask Aether</Link></>}
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          ["Status", titleCase(event.status)], ["Confidence", `${event.automatedConfidence}%`], ["Supporting sources", event.supportingSourceCount], ["Official sources", event.officialSourceCount], ["Contradictions", event.contradictionCount], ["Reports", event.sourceReportIds.length], ["Watchlists", event.watchlistIds.length], ["Updated", new Date(event.lastUpdatedAt).toLocaleDateString("en", { month: "short", day: "2-digit", timeZone: "UTC" })],
        ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-white/[.08] bg-[#101820]/80 p-3"><p className="text-[8px] font-bold uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-2 text-sm font-semibold text-slate-200">{value}</p></div>)}
      </section>
      <EventDossier event={event} reports={reports} sources={runtime.sources.length ? runtime.sources : demoSources} relatedEvents={relatedEvents} timeline={timeline} audit={audit} graphNodes={graphNodes} relationships={impactRelationships} marketAssets={runtime.marketAssets.length ? runtime.marketAssets : demoMarketAssets} marketImpacts={marketImpacts} />
    </main>
  );
}
