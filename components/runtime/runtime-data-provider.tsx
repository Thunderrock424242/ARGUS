import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DEFAULT_DATASET } from "@/packages/database/provider";
import { demoAuditEntries, demoTimelineEntries } from "@/packages/shared/demo-data";
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
  refresh(): void;
}

const initialData: RuntimeData = {
  events: structuredClone([...DEFAULT_DATASET.events]),
  reports: structuredClone([...DEFAULT_DATASET.reports]),
  sources: structuredClone([...DEFAULT_DATASET.sources]),
  relationships: structuredClone([...DEFAULT_DATASET.relationships]),
  graphNodes: structuredClone([...DEFAULT_DATASET.graphNodes]),
  relationshipHistory: structuredClone([...DEFAULT_DATASET.relationshipHistory]),
  marketAssets: structuredClone([...DEFAULT_DATASET.marketAssets]),
  marketImpacts: structuredClone([...DEFAULT_DATASET.marketImpacts]),
  alerts: structuredClone([...DEFAULT_DATASET.alerts]),
  timelineEntries: structuredClone(demoTimelineEntries),
  auditEntries: structuredClone(demoAuditEntries),
};

const RuntimeDataContext = createContext<RuntimeDataContextValue | null>(null);

export function RuntimeDataProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [data, setData] = useState<RuntimeData>(initialData);
  const [source, setSource] = useState<RuntimeDataSource>("syncing");
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
        const payload = await response.json() as { data: Partial<RuntimeData> & { stateHistory?: EventTimelineEntry[] } };
        if (!active) return;
        setData((current) => ({
          ...current,
          ...payload.data,
          timelineEntries: payload.data.stateHistory ?? current.timelineEntries,
          auditEntries: current.auditEntries,
        }));
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
          if (active) setData((current) => ({ ...current, auditEntries: auditPayload.data }));
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

  const value = useMemo<RuntimeDataContextValue>(() => ({ ...data, source, refresh }), [data, refresh, source]);
  return <RuntimeDataContext.Provider value={value}>{children}</RuntimeDataContext.Provider>;
}

export function useRuntimeData(): RuntimeDataContextValue {
  const context = useContext(RuntimeDataContext);
  if (!context) throw new Error("useRuntimeData must be used within RuntimeDataProvider.");
  return context;
}
