import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBanner, PageHeader, SeverityMark, StatusBadge, buttonClass, primaryButtonClass, titleCase } from "@/components/domain/argus-ui";
import { EventDossier } from "@/components/pages/event-dossier";
import { demoAuditEntries, demoEvents, demoReports, demoSources, demoTimelineEntries } from "@/packages/shared/demo-data";

export function generateStaticParams() {
  return demoEvents.map((event) => ({ slug: event.slug }));
}

export default async function EventDossierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = demoEvents.find((item) => item.slug === slug);
  if (!event) notFound();

  const reports = demoReports.filter((report) => event.sourceReportIds.includes(report.id) || report.eventId === event.id);
  const relatedEvents = demoEvents.filter((candidate) => event.relatedEventIds.includes(candidate.id));
  const timeline = demoTimelineEntries.filter((entry) => entry.eventId === event.id).sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const audit = demoAuditEntries.filter((entry) => entry.targetId === event.id || event.confirmedFacts.some((claim) => claim.id === entry.targetId));

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
      <EventDossier event={event} reports={reports} sources={demoSources} relatedEvents={relatedEvents} timeline={timeline} audit={audit} />
    </main>
  );
}
