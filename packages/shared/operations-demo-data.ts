import {
  DEMONSTRATION_DATA_LABEL,
  demoEvents,
  demoReports,
  demoTimelineEntries,
} from "./demo-data";
import type {
  AlertSettings,
  ConflictProfile,
  ImpactRule,
  IntelligenceAlert,
  IntelligenceEvent,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  IntelligenceStateChange,
  MarketAsset,
  MarketImpactAssessment,
  MonitoringLayout,
  PublicCameraSource,
  RegionalIntelligenceProfile,
  RelationshipHistoryEntry,
} from "./types";

const LABEL = DEMONSTRATION_DATA_LABEL;
const T0 = "2042-03-14T08:00:00.000Z";
const T1 = "2042-03-14T10:30:00.000Z";
const T2 = "2042-03-14T13:15:00.000Z";

function event(slug: string): IntelligenceEvent {
  const match = demoEvents.find((candidate) => candidate.slug === slug);
  if (!match) throw new Error(`Missing ARGUS demonstration event: ${slug}`);
  return match;
}

const earthquake = event("demo-northstar-island-earthquake");
const portClosure = event("demo-port-meridian-lane-closure");
const cableIncident = event("demo-pelagic-undersea-cable-degradation");
const ransomware = event("demo-helios-municipal-ransomware");
const volcano = event("demo-mount-calder-ash-advisory");
const airport = event("demo-novaair-avionics-inspection");
const ceasefire = event("demo-ardent-corridor-ceasefire-report");
const humanitarian = event("demo-haven-humanitarian-corridor-delay");
const grid = event("demo-veridian-grid-frequency-instability");

function eventNode(record: IntelligenceEvent): IntelligenceGraphNode {
  return {
    id: `node-${record.id}`,
    type: "event",
    label: record.title.replace(/^\[DEMO\]\s*/, ""),
    subtitle: `${record.category} · S${record.severity}`,
    description: record.summary,
    eventId: record.id,
    countryCode: record.countryCode,
    region: record.region,
    latitude: record.latitude,
    longitude: record.longitude,
    tags: record.tags,
    dataClassification: "demonstration",
    demoDataLabel: LABEL,
  };
}

function node(
  id: string,
  type: IntelligenceGraphNode["type"],
  label: string,
  description: string,
  tags: string[],
  extra: Partial<IntelligenceGraphNode> = {},
): IntelligenceGraphNode {
  return {
    id,
    type,
    label,
    description,
    tags,
    dataClassification: "demonstration",
    demoDataLabel: LABEL,
    ...extra,
  };
}

export const demoGraphNodes: IntelligenceGraphNode[] = [
  earthquake,
  portClosure,
  cableIncident,
  ransomware,
  volcano,
  airport,
  ceasefire,
  humanitarian,
  grid,
].map(eventNode).concat([
  node("node-port-northstar", "infrastructure", "Northstar Deepwater Port", "Fictional container port exposed to seismic disruption.", ["port", "shipping", "earthquake"], { region: "Northstar Arc", latitude: (earthquake.latitude ?? 0) + 1.4, longitude: (earthquake.longitude ?? 0) + 2.1 }),
  node("node-pelagic-route", "supply-chain", "Pelagic Freight Corridor", "Fictional maritime route connecting island ports to semiconductor assembly hubs.", ["shipping", "freight", "semiconductor"], { latitude: (portClosure.latitude ?? 0) - 3, longitude: (portClosure.longitude ?? 0) + 8 }),
  node("node-semiconductor", "industry", "Advanced Components", "Fictional semiconductor and precision-component industry basket.", ["semiconductor", "manufacturing", "supply-chain"]),
  node("node-chip-etf", "etf", "CHIP-X Components ETF", "Fictional exchange-traded demonstration asset.", ["semiconductor", "technology", "market"]),
  node("node-freight-index", "index", "GFI Freight Index", "Fictional global freight-rate index.", ["shipping", "freight", "market"]),
  node("node-helios-services", "infrastructure", "Helios Civic Services Network", "Fictional municipal identity and public-service network.", ["cyber", "municipal", "public-services"], { latitude: (ransomware.latitude ?? 0) + 0.6, longitude: (ransomware.longitude ?? 0) + 0.8 }),
  node("node-cyber-etf", "etf", "CYBR-X Resilience ETF", "Fictional cybersecurity sector demonstration asset.", ["cyber", "software", "market"]),
  node("node-calder-airspace", "infrastructure", "Calder Flight Information Region", "Fictional controlled airspace monitored for volcanic ash.", ["aviation", "airspace", "volcano"], { latitude: (volcano.latitude ?? 0) + 4, longitude: (volcano.longitude ?? 0) + 6 }),
  node("node-novaair", "company", "NovaAir Cooperative", "Fictional regional airline used only for demonstration.", ["aviation", "airline", "travel"], { latitude: airport.latitude, longitude: airport.longitude }),
  node("node-aero-stock", "stock", "AERO-X", "Fictional airline equity demonstration asset.", ["aviation", "airline", "market"]),
  node("node-pelagic-cable", "infrastructure", "Pelagic East Fiber Trunk", "Fictional undersea telecommunications system.", ["telecommunications", "cable", "internet"], { latitude: (cableIncident.latitude ?? 0) - 2, longitude: (cableIncident.longitude ?? 0) + 5 }),
  node("node-telecom-basket", "industry", "Regional Telecommunications", "Fictional telecommunications industry exposure basket.", ["telecommunications", "internet", "market"]),
  node("node-ardent-region", "region", "Ardent Corridor", "Fictional regional security situation.", ["conflict", "ceasefire", "humanitarian"], { latitude: (ceasefire.latitude ?? 0) + 1, longitude: (ceasefire.longitude ?? 0) + 2 }),
  node("node-haven-crossing", "infrastructure", "Haven Relief Crossing", "Fictional humanitarian access point.", ["humanitarian", "aid", "border"], { latitude: humanitarian.latitude, longitude: humanitarian.longitude }),
  node("node-veridian-grid", "infrastructure", "Veridian Interconnect", "Fictional regional electricity interconnector.", ["power", "grid", "infrastructure"], { latitude: grid.latitude, longitude: grid.longitude }),
  node("node-power-basket", "commodity", "Regional Power Basket", "Fictional wholesale electricity benchmark.", ["power", "commodity", "market"]),
]);

function relationship(
  value: Omit<IntelligenceRelationship, "dataClassification" | "demoDataLabel" | "modelVersion" | "createdAt" | "lastRecalculatedAt"> &
    Partial<Pick<IntelligenceRelationship, "modelVersion" | "createdAt" | "lastRecalculatedAt">>,
): IntelligenceRelationship {
  return {
    modelVersion: "impact-rules-1.0.0",
    createdAt: T0,
    lastRecalculatedAt: T2,
    dataClassification: "demonstration",
    demoDataLabel: LABEL,
    ...value,
  };
}

export const demoRelationships: IntelligenceRelationship[] = [
  relationship({ id: "rel-quake-port", sourceNodeId: `node-${earthquake.id}`, sourceNodeType: "event", targetNodeId: "node-port-northstar", targetNodeType: "infrastructure", relationshipType: "possible-impact", relationshipConfidence: 78, exposureConfidence: 92, causalConfidence: 44, supportingReportIds: earthquake.sourceReportIds.slice(0, 2), contradictingReportIds: earthquake.disputedClaims.flatMap((claim) => claim.contradictingReportIds), explanation: "The earthquake occurred near the port and inspection activity was reported. Disruption remains a hypothesis until the operator confirms operating status.", detectionMethod: "rule", analystState: "needs-review", analystNotes: "Verify port authority bulletin before escalation." }),
  relationship({ id: "rel-port-route", sourceNodeId: "node-port-northstar", sourceNodeType: "infrastructure", targetNodeId: "node-pelagic-route", targetNodeType: "supply-chain", relationshipType: "likely-impact", relationshipConfidence: 74, exposureConfidence: 86, causalConfidence: 39, supportingReportIds: portClosure.sourceReportIds.slice(0, 2), contradictingReportIds: [], explanation: "Restricted berth access overlaps a modeled freight corridor. Shipment delay is plausible; direct loss has not been confirmed.", detectionMethod: "structured-data", analystState: "needs-review" }),
  relationship({ id: "rel-route-components", sourceNodeId: "node-pelagic-route", sourceNodeType: "supply-chain", targetNodeId: "node-semiconductor", targetNodeType: "industry", relationshipType: "hypothesized-consequence", relationshipConfidence: 63, exposureConfidence: 71, causalConfidence: 24, supportingReportIds: portClosure.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "Demonstration manifests associate the corridor with component shipments. No production interruption has been reported.", detectionMethod: "rule", analystState: "needs-review" }),
  relationship({ id: "rel-components-etf", sourceNodeId: "node-semiconductor", sourceNodeType: "industry", targetNodeId: "node-chip-etf", targetNodeType: "etf", relationshipType: "exposure-only", relationshipConfidence: 81, exposureConfidence: 88, causalConfidence: 12, marketAnomalyScore: 57, supportingReportIds: [], contradictingReportIds: [], explanation: "The fictional fund composition creates sector exposure only; it is not evidence that the event caused a price move.", detectionMethod: "market-analysis", analystState: "automated" }),
  relationship({ id: "rel-route-freight", sourceNodeId: "node-pelagic-route", sourceNodeType: "supply-chain", targetNodeId: "node-freight-index", targetNodeType: "index", relationshipType: "correlated-movement", relationshipConfidence: 68, exposureConfidence: 79, causalConfidence: 18, marketAnomalyScore: 76, supportingReportIds: portClosure.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "The fictional freight index moved outside its recent range after the disruption window. Timing alone does not establish causation.", detectionMethod: "market-analysis", analystState: "needs-review" }),
  relationship({ id: "rel-ransomware-services", sourceNodeId: `node-${ransomware.id}`, sourceNodeType: "event", targetNodeId: "node-helios-services", targetNodeType: "infrastructure", relationshipType: "confirmed-impact", relationshipConfidence: 94, exposureConfidence: 98, causalConfidence: 91, supportingReportIds: ransomware.sourceReportIds.slice(0, 3), contradictingReportIds: [], explanation: "Multiple independent reports and the fictional municipal bulletin identify the isolated service network.", detectionMethod: "structured-data", analystState: "confirmed", analystNotes: "Impact scope confirmed; restoration time remains uncertain." }),
  relationship({ id: "rel-services-cyber", sourceNodeId: "node-helios-services", sourceNodeType: "infrastructure", targetNodeId: "node-cyber-etf", targetNodeType: "etf", relationshipType: "exposure-only", relationshipConfidence: 59, exposureConfidence: 73, causalConfidence: 9, marketAnomalyScore: 42, supportingReportIds: ransomware.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "The asset has cybersecurity exposure, but no unusual independent movement is detected.", detectionMethod: "market-analysis", analystState: "automated" }),
  relationship({ id: "rel-volcano-airspace", sourceNodeId: `node-${volcano.id}`, sourceNodeType: "event", targetNodeId: "node-calder-airspace", targetNodeType: "infrastructure", relationshipType: "triggered-response", relationshipConfidence: 89, exposureConfidence: 96, causalConfidence: 87, supportingReportIds: volcano.sourceReportIds.slice(0, 2), contradictingReportIds: [], explanation: "A published ash advisory triggered a defined airspace monitoring response.", detectionMethod: "structured-data", analystState: "confirmed" }),
  relationship({ id: "rel-airspace-airline", sourceNodeId: "node-calder-airspace", sourceNodeType: "infrastructure", targetNodeId: "node-novaair", targetNodeType: "company", relationshipType: "possible-impact", relationshipConfidence: 67, exposureConfidence: 84, causalConfidence: 31, supportingReportIds: volcano.sourceReportIds.slice(0, 1), contradictingReportIds: airport.sourceReportIds.slice(-1), explanation: "Route overlap creates operational exposure, while a later carrier report disputes widespread cancellations.", detectionMethod: "rule", analystState: "disputed" }),
  relationship({ id: "rel-airline-stock", sourceNodeId: "node-novaair", sourceNodeType: "company", targetNodeId: "node-aero-stock", targetNodeType: "stock", relationshipType: "correlated-movement", relationshipConfidence: 72, exposureConfidence: 95, causalConfidence: 22, marketAnomalyScore: 82, supportingReportIds: airport.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "AERO-X moved unusually during the event window, but broader travel-sector weakness offers an alternative explanation.", detectionMethod: "market-analysis", analystState: "needs-review" }),
  relationship({ id: "rel-cable-infrastructure", sourceNodeId: `node-${cableIncident.id}`, sourceNodeType: "event", targetNodeId: "node-pelagic-cable", targetNodeType: "infrastructure", relationshipType: "likely-impact", relationshipConfidence: 86, exposureConfidence: 97, causalConfidence: 68, supportingReportIds: cableIncident.sourceReportIds.slice(0, 2), contradictingReportIds: cableIncident.disputedClaims.flatMap((claim) => claim.contradictingReportIds), explanation: "Telemetry degradation and route alignment support an infrastructure relationship; the physical cause remains disputed.", detectionMethod: "structured-data", analystState: "disputed" }),
  relationship({ id: "rel-cable-telecom", sourceNodeId: "node-pelagic-cable", sourceNodeType: "infrastructure", targetNodeId: "node-telecom-basket", targetNodeType: "industry", relationshipType: "possible-impact", relationshipConfidence: 70, exposureConfidence: 83, causalConfidence: 28, supportingReportIds: cableIncident.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "Regional carriers share modeled capacity on the route. Customer-level impact is not confirmed.", detectionMethod: "rule", analystState: "needs-review" }),
  relationship({ id: "rel-ceasefire-region", sourceNodeId: `node-${ceasefire.id}`, sourceNodeType: "event", targetNodeId: "node-ardent-region", targetNodeType: "region", relationshipType: "deescalated", relationshipConfidence: 76, causalConfidence: 52, supportingReportIds: ceasefire.sourceReportIds.slice(0, 2), contradictingReportIds: ceasefire.disputedClaims.flatMap((claim) => claim.contradictingReportIds), explanation: "Reported ceasefire language suggests de-escalation, but implementation and geographic scope remain disputed.", detectionMethod: "semantic-analysis", analystState: "needs-review" }),
  relationship({ id: "rel-region-crossing", sourceNodeId: "node-ardent-region", sourceNodeType: "region", targetNodeId: "node-haven-crossing", targetNodeType: "infrastructure", relationshipType: "possible-impact", relationshipConfidence: 69, exposureConfidence: 91, causalConfidence: 34, supportingReportIds: humanitarian.sourceReportIds.slice(0, 2), contradictingReportIds: [], explanation: "Access restrictions coincide with the security situation, but ARGUS has not confirmed a direct causal order.", detectionMethod: "rule", analystState: "needs-review" }),
  relationship({ id: "rel-grid-power", sourceNodeId: `node-${grid.id}`, sourceNodeType: "event", targetNodeId: "node-power-basket", targetNodeType: "commodity", relationshipType: "correlated-movement", relationshipConfidence: 66, exposureConfidence: 88, causalConfidence: 20, marketAnomalyScore: 71, supportingReportIds: grid.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "The fictional power benchmark moved unusually after grid instability; weather demand remains a competing explanation.", detectionMethod: "market-analysis", analystState: "needs-review" }),
  relationship({ id: "rel-rejected-weather-airline", sourceNodeId: `node-${airport.id}`, sourceNodeType: "event", targetNodeId: "node-aero-stock", targetNodeType: "stock", relationshipType: "analyst-rejected", relationshipConfidence: 18, exposureConfidence: 93, causalConfidence: 3, marketAnomalyScore: 28, supportingReportIds: airport.sourceReportIds.slice(0, 1), contradictingReportIds: airport.sourceReportIds.slice(1, 2), explanation: "An analyst rejected the proposed link after carrier disclosures attributed the inspection to scheduled maintenance.", detectionMethod: "analyst", analystState: "rejected", analystNotes: "Do not re-alert unless new operational evidence appears." }),
];

export const demoRelationshipHistory: RelationshipHistoryEntry[] = demoRelationships.flatMap((item, index) => [
  { id: `rel-history-${index}-initial`, relationshipId: item.id, occurredAt: item.createdAt, relationshipConfidence: Math.max(5, item.relationshipConfidence - 9), exposureConfidence: item.exposureConfidence, causalConfidence: Math.max(0, (item.causalConfidence ?? 0) - 5), marketAnomalyScore: item.marketAnomalyScore, analystState: "automated", explanation: "Initial deterministic relationship candidate created from available evidence.", supportingReportIds: item.supportingReportIds.slice(0, 1), contradictingReportIds: [], rulesetVersion: "impact-rules-1.0.0", actor: "system", dataClassification: "demonstration" },
  { id: `rel-history-${index}-current`, relationshipId: item.id, occurredAt: item.lastRecalculatedAt, relationshipConfidence: item.relationshipConfidence, exposureConfidence: item.exposureConfidence, causalConfidence: item.causalConfidence, marketAnomalyScore: item.marketAnomalyScore, analystState: item.analystState, explanation: item.explanation, supportingReportIds: item.supportingReportIds, contradictingReportIds: item.contradictingReportIds, rulesetVersion: item.modelVersion, actor: item.detectionMethod === "analyst" ? "analyst" : "system", dataClassification: "demonstration" },
]);

export const demoImpactRules: ImpactRule[] = [
  { id: "rule-earthquake-port", name: "Earthquake near major port", enabled: true, triggerCategories: ["disaster"], requiredKeywords: ["earthquake"], targetNodeTypes: ["infrastructure"], targetNodeIds: ["node-port-northstar"], relationshipType: "possible-impact", timeWindowHours: 24, maximumDistanceKm: 250, baseRelationshipConfidence: 68, baseExposureConfidence: 88, baseCausalConfidence: 28, conditions: [{ field: "severity", operator: "minimum", value: 3 }], explanationTemplate: "Seismic activity overlaps a modeled port exposure. Hypothesis — analyst review required.", createdAt: T0, updatedAt: T2 },
  { id: "rule-conflict-shipping", name: "Conflict near relief route", enabled: true, triggerCategories: ["conflict", "political"], requiredKeywords: ["corridor"], targetNodeTypes: ["infrastructure", "supply-chain"], targetNodeIds: ["node-haven-crossing", "node-pelagic-route"], relationshipType: "hypothesized-consequence", timeWindowHours: 48, baseRelationshipConfidence: 58, baseExposureConfidence: 76, baseCausalConfidence: 20, conditions: [], explanationTemplate: "Security activity overlaps a modeled logistics route. Hypothesis — analyst review required.", createdAt: T0, updatedAt: T2 },
  { id: "rule-cyber-services", name: "Critical vulnerability affects public services", enabled: true, triggerCategories: ["cyber"], requiredKeywords: ["ransomware"], targetNodeTypes: ["infrastructure", "industry"], targetNodeIds: ["node-helios-services", "node-cyber-etf"], relationshipType: "possible-impact", timeWindowHours: 72, baseRelationshipConfidence: 65, baseExposureConfidence: 82, baseCausalConfidence: 30, conditions: [], explanationTemplate: "Cyber reporting overlaps a modeled service dependency. Hypothesis — analyst review required.", createdAt: T0, updatedAt: T2 },
  { id: "rule-airspace-airline", name: "Airspace restriction affects airline", enabled: true, triggerCategories: ["aviation", "disaster"], requiredKeywords: ["ash", "airspace"], targetNodeTypes: ["infrastructure", "company", "stock"], targetNodeIds: ["node-calder-airspace", "node-novaair", "node-aero-stock"], relationshipType: "possible-impact", timeWindowHours: 36, baseRelationshipConfidence: 61, baseExposureConfidence: 84, baseCausalConfidence: 25, conditions: [], explanationTemplate: "Airspace conditions overlap a modeled airline route. Hypothesis — analyst review required.", createdAt: T0, updatedAt: T2 },
  { id: "rule-grid-power", name: "Grid instability and power exposure", enabled: true, triggerCategories: ["infrastructure"], requiredKeywords: ["grid"], targetNodeTypes: ["infrastructure", "commodity"], targetNodeIds: ["node-veridian-grid", "node-power-basket"], relationshipType: "possible-impact", timeWindowHours: 12, baseRelationshipConfidence: 64, baseExposureConfidence: 90, baseCausalConfidence: 22, conditions: [{ field: "severity", operator: "minimum", value: 3 }], explanationTemplate: "Grid instability overlaps a modeled power-market exposure. Hypothesis — analyst review required.", createdAt: T0, updatedAt: T2 },
];

export const demoMarketAssets: MarketAsset[] = [
  { id: "asset-chip-x", symbol: "CHIP-X", name: "Components Resilience ETF", type: "etf", exchange: "DEMO", currency: "XDC", sector: "Technology", industry: "Semiconductors", exposureTags: ["semiconductor", "shipping", "components"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-gfi", symbol: "GFI", name: "Global Freight Index", type: "index", exchange: "DEMO", currency: "XDC", sector: "Industrials", exposureTags: ["shipping", "freight", "port"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-cybr-x", symbol: "CYBR-X", name: "Digital Resilience ETF", type: "etf", exchange: "DEMO", currency: "XDC", sector: "Technology", industry: "Cybersecurity", exposureTags: ["cyber", "ransomware", "software"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-aero-x", symbol: "AERO-X", name: "NovaAir Cooperative", type: "stock", exchange: "DEMO", currency: "XDC", sector: "Industrials", industry: "Airlines", exposureTags: ["aviation", "airspace", "travel"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-power", symbol: "PWR-B", name: "Regional Power Basket", type: "commodity", exchange: "DEMO", currency: "XDC", exposureTags: ["power", "grid", "energy"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-telecom", symbol: "TEL-X", name: "Regional Telecommunications Basket", type: "industry-basket", exchange: "DEMO", currency: "XDC", sector: "Communications", exposureTags: ["telecommunications", "cable", "internet"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-ardent-fx", symbol: "ARD/XDC", name: "Ardent Demonstration Currency", type: "currency", currency: "ARD", countryCode: "XA", exposureTags: ["ardent", "conflict", "sanctions"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "asset-northstar-debt", symbol: "NST-10Y", name: "Northstar 10Y Demonstration Note", type: "government-debt", currency: "XDC", countryCode: earthquake.countryCode, exposureTags: ["northstar", "earthquake", "sovereign"], dataClassification: "demonstration", demoDataLabel: LABEL },
];

function assessment(value: Omit<MarketImpactAssessment, "dataClassification" | "demoDataLabel" | "modelVersion" | "calculatedAt">): MarketImpactAssessment {
  return { ...value, modelVersion: "market-anomaly-1.0.0", calculatedAt: T2, dataClassification: "demonstration", demoDataLabel: LABEL };
}

export const demoMarketImpacts: MarketImpactAssessment[] = [
  assessment({ id: "market-freight", eventId: portClosure.id, assetId: "asset-gfi", exposureConfidence: 89, relationshipConfidence: 73, marketAnomalyScore: 76, causalConfidence: 18, priceBefore: 104.2, priceAfter: 109.8, percentChange: 5.37, volumeChangePercent: 142, normalVolatility: 1.4, sectorChangePercent: 0.8, indexChangePercent: 0.4, broaderMarketChangePercent: 0.2, supportingReportIds: portClosure.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "Possible market impact detected. GFI moved unusually after the event, but direct causation has not been confirmed.", analystState: "needs-review" }),
  assessment({ id: "market-aero", eventId: volcano.id, assetId: "asset-aero-x", exposureConfidence: 95, relationshipConfidence: 72, marketAnomalyScore: 82, causalConfidence: 22, priceBefore: 42.6, priceAfter: 39.7, percentChange: -6.81, volumeChangePercent: 188, normalVolatility: 1.9, sectorChangePercent: -2.1, indexChangePercent: -0.4, broaderMarketChangePercent: -0.2, supportingReportIds: volcano.sourceReportIds.slice(0, 1), contradictingReportIds: airport.sourceReportIds.slice(0, 1), explanation: "Possible market impact detected. AERO-X underperformed its fictional sector after the ash advisory, while scheduled inspections provide a competing explanation.", analystState: "disputed" }),
  assessment({ id: "market-power", eventId: grid.id, assetId: "asset-power", exposureConfidence: 92, relationshipConfidence: 66, marketAnomalyScore: 71, causalConfidence: 20, priceBefore: 71.4, priceAfter: 75.1, percentChange: 5.18, volumeChangePercent: 96, normalVolatility: 2.2, sectorChangePercent: 1.4, indexChangePercent: 0.3, broaderMarketChangePercent: 0.1, supportingReportIds: grid.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "Possible market impact detected. The fictional power basket exceeded its normal range, but weather demand may explain part of the movement.", analystState: "needs-review" }),
  assessment({ id: "market-cyber", eventId: ransomware.id, assetId: "asset-cybr-x", exposureConfidence: 78, relationshipConfidence: 54, marketAnomalyScore: 42, causalConfidence: 8, priceBefore: 58.3, priceAfter: 58.9, percentChange: 1.03, volumeChangePercent: 24, normalVolatility: 1.7, sectorChangePercent: 0.8, indexChangePercent: 0.5, broaderMarketChangePercent: 0.4, supportingReportIds: ransomware.sourceReportIds.slice(0, 1), contradictingReportIds: [], explanation: "Exposure exists, but movement remains inside the fictional asset's recent volatility range. No market anomaly is asserted.", analystState: "automated" }),
];

export const demoConflictProfiles: ConflictProfile[] = [
  { id: "conflict-ardent", slug: "ardent-corridor-security-situation", name: "Ardent Corridor Security Situation", countries: ["Ardent Republic", "Haven Federation"], regions: ["Ardent Corridor", "Haven Frontier"], startDate: "2041-11-03T00:00:00.000Z", currentPhase: "Contested ceasefire implementation", keyActorNodeIds: ["node-ardent-region", "node-haven-crossing"], territorialAreas: ["Northern corridor", "Haven relief crossing"], eventIds: [ceasefire.id, humanitarian.id], relationshipIds: ["rel-ceasefire-region", "rel-region-crossing"], estimates: [{ id: "estimate-ardent-displaced-a", metric: "displaced", minimum: 18_000, maximum: 24_000, asOf: "2042-03-13T00:00:00.000Z", sourceReportIds: humanitarian.sourceReportIds.slice(0, 1), confidence: 54, methodology: "Fictional relief-agency registration range; cross-border movement may be undercounted." }, { id: "estimate-ardent-displaced-b", metric: "displaced", minimum: 12_000, maximum: 31_000, asOf: "2042-03-12T00:00:00.000Z", sourceReportIds: humanitarian.sourceReportIds.slice(1, 2), confidence: 38, methodology: "Fictional remote estimate with broader geographic coverage and higher uncertainty." }], recentDevelopments: ["Ceasefire language reported by multiple sources.", "Relief access remains delayed at the Haven crossing.", "Implementation boundaries and monitoring mechanism remain disputed."], humanitarianEffects: ["Aid convoys delayed", "Displacement estimates remain source-dependent"], infrastructureEffects: ["Border crossing operating below modeled capacity"], economicEffects: ["Freight and local currency exposure under review"], relatedSanctions: ["No new sanctions confirmed in this demonstration snapshot."], collectionGaps: ["No independent observer report from the northern corridor.", "Casualty figures cannot be reconciled without methodological notes."], disputedFigures: ["Displacement estimates differ by coverage window and registration method."], analystNotes: "Do not consolidate source estimates into one unsupported total.", aetherAssessment: "The situation may be de-escalating politically while humanitarian access remains constrained. The two trends should not be treated as equivalent.", updatedAt: T2, dataClassification: "demonstration", demoDataLabel: LABEL },
];

export const demoRegionalProfiles: RegionalIntelligenceProfile[] = [
  { id: "region-northstar", name: "Northstar Arc", kind: "region", threatLevel: "high", threatEvidenceReportIds: earthquake.sourceReportIds.slice(0, 2), activeEventIds: [earthquake.id, portClosure.id], developingEventIds: [earthquake.id], conflictProfileIds: [], keyNodeIds: ["node-port-northstar", "node-pelagic-route"], marketAssessmentIds: ["market-freight"], watchlistIds: earthquake.watchlistIds, strategicInfrastructure: ["Northstar Deepwater Port", "Pelagic Freight Corridor"], collectionGaps: ["Independent port-operability confirmation pending."], latestAssessment: "Seismic disruption is confirmed; downstream logistics effects remain plausible but unverified.", analystNotes: "Prioritize port authority and carrier notices.", updatedAt: T2, dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "country-ardent", name: "Ardent Republic", kind: "country", countryCode: "XA", threatLevel: "elevated", threatEvidenceReportIds: ceasefire.sourceReportIds.slice(0, 2), activeEventIds: [ceasefire.id, humanitarian.id], developingEventIds: [humanitarian.id], conflictProfileIds: ["conflict-ardent"], keyNodeIds: ["node-ardent-region", "node-haven-crossing"], marketAssessmentIds: [], watchlistIds: ceasefire.watchlistIds, strategicInfrastructure: ["Haven Relief Crossing"], collectionGaps: ["No verified access to the northern monitoring zone."], latestAssessment: "Ceasefire reporting lowers immediate escalation indicators, but implementation and relief access remain uncertain.", analystNotes: "Keep political and humanitarian assessments separate.", updatedAt: T2, dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "region-pelagic", name: "Pelagic Communications Zone", kind: "region", threatLevel: "guarded", threatEvidenceReportIds: cableIncident.sourceReportIds.slice(0, 2), activeEventIds: [cableIncident.id], developingEventIds: [cableIncident.id], conflictProfileIds: [], keyNodeIds: ["node-pelagic-cable", "node-telecom-basket"], marketAssessmentIds: [], watchlistIds: cableIncident.watchlistIds, strategicInfrastructure: ["Pelagic East Fiber Trunk"], collectionGaps: ["Physical inspection has not confirmed cable damage."], latestAssessment: "Service degradation is observed; root cause and customer-level effects remain disputed.", analystNotes: "Avoid attributing the degradation to deliberate activity without evidence.", updatedAt: T2, dataClassification: "demonstration", demoDataLabel: LABEL },
];

export const demoStateHistory: IntelligenceStateChange[] = [
  ...demoTimelineEntries.slice(0, 16).map((entry) => ({ id: `state-${entry.id}`, occurredAt: entry.occurredAt, type: entry.type, eventId: entry.eventId, title: entry.title, description: entry.description, reportIds: entry.reportIds, actor: entry.actor, dataClassification: "demonstration" as const })),
  ...demoRelationships.slice(0, 8).map((item, index) => ({ id: `state-${item.id}`, occurredAt: index % 2 ? T1 : T2, type: "relationship-created" as const, relationshipId: item.id, title: "Relationship candidate formed", description: item.explanation, reportIds: item.supportingReportIds, actor: "system" as const, dataClassification: "demonstration" as const })),
  ...demoMarketImpacts.map((item) => ({ id: `state-${item.id}`, occurredAt: item.calculatedAt, type: "market-assessment-created" as const, eventId: item.eventId, marketAssessmentId: item.id, title: "Market assessment recalculated", description: item.explanation, reportIds: item.supportingReportIds, actor: "system" as const, dataClassification: "demonstration" as const })),
].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

export const demoAlerts: IntelligenceAlert[] = [
  { id: "alert-quake", type: "priority-event", priority: "critical", state: "active", title: "Priority event detected", message: earthquake.title, voiceMessage: "Priority event detected.", eventId: earthquake.id, createdAt: T0, deduplicationKey: `event:${earthquake.id}:priority`, cooldownSeconds: 900, visualRequired: true, dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "alert-relationship", type: "consequence-predicted", priority: "high", state: "queued", title: "Possible downstream impact identified", message: "Northstar port exposure may affect the Pelagic freight corridor.", voiceMessage: "Possible downstream impact identified.", relationshipId: "rel-port-route", createdAt: T1, deduplicationKey: "relationship:rel-port-route", cooldownSeconds: 1800, visualRequired: true, dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "alert-market", type: "market-anomaly", priority: "high", state: "queued", title: "Market anomaly detected", message: "AERO-X moved outside its recent demonstration range.", voiceMessage: "Market anomaly detected.", relationshipId: "rel-airline-stock", createdAt: T2, deduplicationKey: "market:market-aero", cooldownSeconds: 3600, visualRequired: true, dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "alert-contradiction", type: "contradiction", priority: "high", state: "acknowledged", title: "Conflicting intelligence detected", message: "Carrier reporting disputes widespread cancellations near Calder airspace.", voiceMessage: "Conflicting intelligence detected.", eventId: volcano.id, createdAt: T1, acknowledgedAt: T2, deduplicationKey: `event:${volcano.id}:contradiction`, cooldownSeconds: 1800, visualRequired: true, dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "alert-cable", type: "infrastructure-disruption", priority: "normal", state: "queued", title: "Infrastructure disruption detected", message: cableIncident.title, voiceMessage: "Infrastructure disruption detected.", eventId: cableIncident.id, createdAt: T2, deduplicationKey: `event:${cableIncident.id}:infrastructure`, cooldownSeconds: 1800, visualRequired: true, dataClassification: "demonstration", demoDataLabel: LABEL },
];

export const defaultAlertSettings: AlertSettings = {
  masterAudio: false,
  voiceAlerts: true,
  interfaceSounds: true,
  voiceVolume: 0.75,
  soundVolume: 0.35,
  minimumSeverity: 3,
  minimumConfidence: 60,
  minimumRelationshipConfidence: 65,
  minimumMarketAnomaly: 70,
  enabledCategories: ["conflict", "cyber", "disaster", "infrastructure", "maritime", "aviation"],
  enabledRegions: [],
  enabledAssetTypes: ["stock", "etf", "index", "commodity", "currency"],
  watchlistOnly: false,
  quietMode: false,
  repeatCooldownMinutes: 30,
  speechRate: 0.95,
};

export const demoCameraSources: PublicCameraSource[] = [
  { id: "camera-northstar-port", name: "Northstar Port Weather View", operator: "Northstar Port Demonstration Authority", sourceUrl: "https://example.com/argus-demo/northstar-port", latitude: earthquake.latitude ?? 0, longitude: earthquake.longitude ?? 0, location: "Northstar Deepwater Port", country: earthquake.countryName ?? "Northstar", category: "port", usageInformation: "Fictional record demonstrating a link-only public camera policy.", attributionRequirements: "Display operator name and source link.", embedPermission: "link-only", lastSuccessfulCheck: T1, availability: "available", relatedEventIds: [earthquake.id, portClosure.id], relatedRegionIds: ["region-northstar"], relatedInfrastructureIds: ["node-port-northstar"], refreshIntervalSeconds: 120, accessRestrictions: ["No redistribution", "No automated recording"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "camera-calder-observatory", name: "Calder Observatory Summit Camera", operator: "Calder Geological Demonstration Service", sourceUrl: "https://example.com/argus-demo/calder-observatory", latitude: volcano.latitude ?? 0, longitude: volcano.longitude ?? 0, location: volcano.locationName ?? "Mount Calder", country: volcano.countryName ?? "Calder", category: "volcano", usageInformation: "Fictional observatory source; embedding permission has not been verified.", attributionRequirements: "Link to operator and observation time.", embedPermission: "unknown", availability: "blocked", relatedEventIds: [volcano.id], relatedRegionIds: [], relatedInfrastructureIds: ["node-calder-airspace"], refreshIntervalSeconds: 300, accessRestrictions: ["Embedding disabled until permission is verified"], dataClassification: "demonstration", demoDataLabel: LABEL },
  { id: "camera-haven-crossing", name: "Haven Crossing Traffic View", operator: "Haven Roads Demonstration Agency", sourceUrl: "https://example.com/argus-demo/haven-crossing", latitude: humanitarian.latitude ?? 0, longitude: humanitarian.longitude ?? 0, location: humanitarian.locationName ?? "Haven Crossing", country: humanitarian.countryName ?? "Haven Federation", category: "traffic", usageInformation: "Fictional public traffic-camera registry entry.", attributionRequirements: "Display operator and do not identify individuals.", embedPermission: "link-only", lastSuccessfulCheck: T0, availability: "unavailable", relatedEventIds: [humanitarian.id], relatedRegionIds: ["country-ardent"], relatedInfrastructureIds: ["node-haven-crossing"], refreshIntervalSeconds: 180, accessRestrictions: ["No facial identification", "No access-control bypass"], dataClassification: "demonstration", demoDataLabel: LABEL },
];

export const demoMonitoringLayouts: MonitoringLayout[] = [
  { id: "layout-global-watch", name: "Global Watch", updatedAt: T2, widgets: [
    { id: "widget-map", type: "map", title: "Global operations map", x: 0, y: 0, width: 8, height: 7, configuration: { layer: "all", live: true } },
    { id: "widget-alerts", type: "alert-stream", title: "Breaking alerts", x: 8, y: 0, width: 4, height: 3, configuration: { minimumPriority: "high" } },
    { id: "widget-reports", type: "report-feed", title: "Live report stream", x: 8, y: 3, width: 4, height: 4, configuration: { paused: false } },
    { id: "widget-graph", type: "impact-graph", title: "Impact chain", x: 0, y: 7, width: 6, height: 5, configuration: { relationshipId: "rel-quake-port" } },
    { id: "widget-market", type: "market-chart", title: "Market anomalies", x: 6, y: 7, width: 3, height: 5, configuration: { threshold: 65 } },
    { id: "widget-health", type: "collector-status", title: "Collector health", x: 9, y: 7, width: 3, height: 5, configuration: { compact: true } },
  ], dataClassification: "demonstration", demoDataLabel: LABEL },
];

export const demoOperationsCounts = {
  graphNodes: demoGraphNodes.length,
  relationships: demoRelationships.length,
  consequencesAwaitingReview: demoRelationships.filter((item) => item.analystState === "needs-review").length,
  marketAnomalies: demoMarketImpacts.filter((item) => item.marketAnomalyScore >= 70).length,
  activeAlerts: demoAlerts.filter((item) => item.state === "active" || item.state === "queued").length,
  cameraSources: demoCameraSources.length,
  reportStream: demoReports.length,
};
