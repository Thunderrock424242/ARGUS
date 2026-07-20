import { DemoBanner, PageHeader, StatusBadge } from "@/components/domain/argus-ui";
import { LiveFeeds } from "@/components/operations/live-feeds";
import { demoCameraSources } from "@/packages/shared/operations-demo-data";

export default function LiveFeedsPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Public visual sources / controlled registry" title="Live feeds" description="Inspect attributed public-camera metadata and operator restrictions. ARGUS never proxies, bypasses, or embeds a feed until permission is explicitly verified." actions={<><StatusBadge tone="cyan">{demoCameraSources.length} registered</StatusBadge><StatusBadge tone="amber">Permission gated</StatusBadge></>} /><LiveFeeds cameras={demoCameraSources} /></main>;
}
