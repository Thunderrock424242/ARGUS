import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DEFAULT_DATASET } from "@/packages/database/provider";
import { demoAuditEntries, demoTimelineEntries } from "@/packages/shared/demo-data";
import { browserDemoDataEnabled, recordsVisibleInDemoMode } from "@/lib/config/demo-mode";
import type {
  AuditLogEntry,
  EventTimelineEntry,
  IntelligenceAlert,
  IntelligenceEvent,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  IntelligenceSource,
  MarketAsset,
  MarketImpactAssessment,
  RelationshipHistoryEntry,
  SourceReport,
} from "@/packages/shared/types";

type RuntimeDataSource = "fixtures" | "syncing" | "d1" | "worker-fixtures" | "degraded";

interface RuntimeData {
  events: IntelligenceEvent[];
  reports: SourceReport[];
  sources: IntelligenceSource[];
  relationships: IntelligenceRelationship[];
  graphNodes: IntelligenceGraphNode[];
  relationshipHistory: RelationshipHistoryEntry[];
  marketAssets: MarketAsset[];
  marketImpacts: MarketImpactAssessment[];
  alerts: IntelligenceAlert[];
  timelineEntries: EventTimelineEntry[];
  auditEntries: AuditLogEntry[];
}

interface RuntimeDataContextValue extends RuntimeData {
  source: RuntimeDataSource;
  demoEnabled: boolean;
  refresh(): void;
}

const initialData: RuntimeData = {
  events: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.events]) : [],
  reports: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.reports]) : [],
  sources: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.sources]) : [],
  relationships: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.relationships]) : [],
  graphNodes: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.graphNodes]) : [],
  relationshipHistory: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.relationshipHistory]) : [],
  marketAssets: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.marketAssets]) : [],
  marketImpacts: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.marketImpacts]) : [],
  alerts: browserDemoDataEnabled ? structuredClone([...DEFAULT_DATASET.alerts]) : [],
  timelineEntries: browserDemoDataEnabled ? structuredClone(demoTimelineEntries) : [],
  auditEntries: browserDemoDataEnabled ? structuredClone(demoAuditEntries) : [],
};

const RuntimeDataContext = createContext<RuntimeDataContextValue | null>(null);

export function RuntimeDataProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [data, setData] = useState<RuntimeData>(initialData);
  const [source, setSource] = useState<RuntimeDataSource>("syncing");
  const [demoEnabled, setDemoEnabled] = useState(browserDemoDataEnabled);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => {
    setSource("syncing");
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await auth.publicFetch("/api/operations/snapshot", { signal: controller.signal });
        if (!response.ok) throw new Error("The runtime snapshot was not accepted.");
        const payload = await response.json() as { data: Partial<RuntimeData> & { stateHistory?: EventTimelineEntry[] }; meta?: { demoDataEnabled?: boolean } };
        if (!active) return;
        const effectiveDemoEnabled = browserDemoDataEnabled && payload.meta?.demoDataEnabled !== false;
        setData((current) => ({
          events: recordsVisibleInDemoMode(payload.data.events, effectiveDemoEnabled) ?? current.events,
          reports: recordsVisibleInDemoMode(payload.data.reports, effectiveDemoEnabled) ?? current.reports,
          sources: recordsVisibleInDemoMode(payload.data.sources, effectiveDemoEnabled) ?? current.sources,
          relationships: recordsVisibleInDemoMode(payload.data.relationships, effectiveDemoEnabled) ?? current.relationships,
          graphNodes: recordsVisibleInDemoMode(payload.data.graphNodes, effectiveDemoEnabled) ?? current.graphNodes,
          relationshipHistory: recordsVisibleInDemoMode(payload.data.relationshipHistory, effectiveDemoEnabled) ?? current.relationshipHistory,
          marketAssets: recordsVisibleInDemoMode(payload.data.marketAssets, effectiveDemoEnabled) ?? current.marketAssets,
          marketImpacts: recordsVisibleInDemoMode(payload.data.marketImpacts, effectiveDemoEnabled) ?? current.marketImpacts,
          alerts: recordsVisibleInDemoMode(payload.data.alerts, effectiveDemoEnabled) ?? current.alerts,
          timelineEntries: recordsVisibleInDemoMode(payload.data.stateHistory ?? payload.data.timelineEntries, effectiveDemoEnabled) ?? current.timelineEntries,
          auditEntries: effectiveDemoEnabled
            ? recordsVisibleInDemoMode(payload.data.auditEntries, true) ?? current.auditEntries
            : recordsVisibleInDemoMode(payload.data.auditEntries, false) ?? [],
        }));
        setDemoEnabled(effectiveDemoEnabled);
        setSource(response.headers.get("x-argus-data-store") === "d1" ? "d1" : "worker-fixtures");
      } catch {
        if (!active || controller.signal.aborted) return;
        setSource("degraded");
      }

      if (auth.status === "authenticated" && auth.can("events:review")) {
        try {
          const auditResponse = await auth.authenticatedFetch("/api/admin/audit?page=1&limit=100", { signal: controller.signal });
          if (!auditResponse.ok) throw new Error("The audit history was not accepted.");
          const auditPayload = await auditResponse.json() as { data: AuditLogEntry[] };
          if (active) {
            setData((current) => ({
              ...current,
              auditEntries: recordsVisibleInDemoMode(auditPayload.data, browserDemoDataEnabled) ?? [],
            }));
          }
        } catch {
          // The durable public data remains useful if protected audit history is unavailable.
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [auth, refreshKey]);

  const value = useMemo<RuntimeDataContextValue>(() => ({ ...data, source, demoEnabled, refresh }), [data, demoEnabled, refresh, source]);
  return <RuntimeDataContext.Provider value={value}>{children}</RuntimeDataContext.Provider>;
}

export function useRuntimeData(): RuntimeDataContextValue {
  const context = useContext(RuntimeDataContext);
  if (!context) throw new Error("useRuntimeData must be used within RuntimeDataProvider.");
  return context;
}
