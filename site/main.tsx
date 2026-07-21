import { lazy, StrictMode, Suspense, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import Loading from "@/app/loading";
import "@/app/globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { AuthProvider } from "@/components/auth/auth-provider";
import { RuntimeDataProvider } from "@/components/runtime/runtime-data-provider";
import { DemoDisabled } from "@/components/ui/demo-disabled";
import { browserDemoDataEnabled } from "@/lib/config/demo-mode";

const AetherPage = lazy(() => import("@/app/aether/page"));
const AlertsPage = lazy(() => import("@/app/alerts/page"));
const BriefPage = lazy(() => import("@/app/briefs/[slug]/page"));
const BriefsPage = lazy(() => import("@/app/briefs/page"));
const EventDossierPage = lazy(() => import("@/app/events/[slug]/page"));
const EventsPage = lazy(() => import("@/app/events/page"));
const ConflictsPage = lazy(() => import("@/app/conflicts/page"));
const ConsequencesPage = lazy(() => import("@/app/consequences/page"));
const DashboardPage = lazy(() => import("@/app/dashboard/page"));
const GlobalMapPage = lazy(() => import("@/app/map/page"));
const LiveFeedsPage = lazy(() => import("@/app/live-feeds/page"));
const NotFound = lazy(() => import("@/app/not-found"));
const CommandCenterPage = lazy(() => import("@/app/page"));
const ReviewPage = lazy(() => import("@/app/review/page"));
const RelationshipsPage = lazy(() => import("@/app/relationships/page"));
const SettingsPage = lazy(() => import("@/app/settings/page"));
const SourcesPage = lazy(() => import("@/app/sources/page"));
const IngestionPage = lazy(() => import("@/app/ingestion/page"));
const SystemPage = lazy(() => import("@/app/system/page"));
const TimelinePage = lazy(() => import("@/app/timeline/page"));
const WatchlistsPage = lazy(() => import("@/app/watchlists/page"));
const MonitoringWallPage = lazy(() => import("@/app/wall/page"));

const routeTitles: Record<string, string> = {
  "/": "Global Operations",
  "/dashboard": "Command Center",
  "/map": "Global Map",
  "/events": "Events",
  "/relationships": "Relationships & Impact",
  "/consequences": "Emerging Consequences",
  "/conflicts": "Conflict & Regional Profiles",
  "/timeline": "Timeline Playback",
  "/alerts": "Alerts & Aether Voice",
  "/live-feeds": "Live Feeds",
  "/wall": "Monitoring Wall",
  "/briefs": "Intelligence Briefs",
  "/watchlists": "Watchlists",
  "/sources": "Sources",
  "/ingestion": "Ingestion Queue",
  "/review": "Review Queue",
  "/aether": "Aether",
  "/system": "System Status",
  "/settings": "Settings",
};

function RouteMetadata() {
  const location = useLocation();
  useEffect(() => {
    const pathname = location.pathname.replace(/\/$/, "") || "/";
    const title = pathname.startsWith("/events/")
      ? "Event Dossier"
      : pathname.startsWith("/briefs/")
        ? "Intelligence Brief"
        : routeTitles[pathname] ?? "Not Found";
    document.title = `${title} | ARGUS`;
  }, [location.pathname]);
  return null;
}

function EventRoute() {
  const { slug = "" } = useParams();
  return <EventDossierPage slug={slug} />;
}

function BriefRoute() {
  const { slug = "" } = useParams();
  return <BriefPage slug={slug} />;
}

function DemoOnlyRoute({ feature, children }: { feature: string; children: ReactNode }) {
  return browserDemoDataEnabled ? children : <DemoDisabled feature={feature} />;
}

function ArgusRoutes() {
  return (
    <>
      <RouteMetadata />
      <AppShell>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<CommandCenterPage />} />
            <Route path="/dashboard" element={<DemoOnlyRoute feature="Command Center"><DashboardPage /></DemoOnlyRoute>} />
            <Route path="/map" element={<DemoOnlyRoute feature="Global Map"><GlobalMapPage /></DemoOnlyRoute>} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:slug" element={<EventRoute />} />
            <Route path="/relationships" element={<RelationshipsPage />} />
            <Route path="/consequences" element={<ConsequencesPage />} />
            <Route path="/conflicts" element={<DemoOnlyRoute feature="Conflict profiles"><ConflictsPage /></DemoOnlyRoute>} />
            <Route path="/timeline" element={<DemoOnlyRoute feature="Timeline"><TimelinePage /></DemoOnlyRoute>} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/live-feeds" element={<DemoOnlyRoute feature="Live feeds"><LiveFeedsPage /></DemoOnlyRoute>} />
            <Route path="/wall" element={<DemoOnlyRoute feature="Monitoring wall"><MonitoringWallPage /></DemoOnlyRoute>} />
            <Route path="/briefs" element={<DemoOnlyRoute feature="Intelligence briefs"><BriefsPage /></DemoOnlyRoute>} />
            <Route path="/briefs/:slug" element={<DemoOnlyRoute feature="Intelligence brief"><BriefRoute /></DemoOnlyRoute>} />
            <Route path="/watchlists" element={<DemoOnlyRoute feature="Watchlists"><WatchlistsPage /></DemoOnlyRoute>} />
            <Route path="/sources" element={<DemoOnlyRoute feature="Source manager"><SourcesPage /></DemoOnlyRoute>} />
            <Route path="/ingestion" element={<IngestionPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/aether" element={<DemoOnlyRoute feature="Aether"><AetherPage /></DemoOnlyRoute>} />
            <Route path="/system" element={<DemoOnlyRoute feature="System fixtures"><SystemPage /></DemoOnlyRoute>} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </>
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;
const root = document.getElementById("root");
if (!root) throw new Error("ARGUS root element is missing.");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <RuntimeDataProvider>
        <BrowserRouter basename={basename}>
          <ArgusRoutes />
        </BrowserRouter>
      </RuntimeDataProvider>
    </AuthProvider>
  </StrictMode>,
);
