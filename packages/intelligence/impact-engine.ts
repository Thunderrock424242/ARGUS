import type {
  ImpactRule,
  ImpactRuleCondition,
  IntelligenceEvent,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  RelationshipHistoryEntry,
} from "@/packages/shared/types";
import { distanceInKilometers } from "./text";

const MODEL_VERSION = "impact-rules-1.0.0";

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function eventText(event: IntelligenceEvent): string {
  return `${event.title} ${event.summary} ${event.tags.join(" ")}`.toLocaleLowerCase("en-US");
}

function conditionMatches(event: IntelligenceEvent, condition: ImpactRuleCondition): boolean {
  const actual =
    condition.field === "category"
      ? event.category
      : condition.field === "severity"
        ? event.severity
        : condition.field === "status"
          ? event.status
          : condition.field === "tag"
            ? event.tags
            : condition.field === "country"
              ? event.countryCode ?? event.countryName ?? ""
              : event.region ?? "";

  if (condition.operator === "minimum") {
    return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value;
  }
  if (condition.operator === "includes") {
    const expected = String(condition.value).toLocaleLowerCase("en-US");
    return Array.isArray(actual)
      ? actual.some((item) => item.toLocaleLowerCase("en-US").includes(expected))
      : String(actual).toLocaleLowerCase("en-US").includes(expected);
  }
  return String(actual).toLocaleLowerCase("en-US") === String(condition.value).toLocaleLowerCase("en-US");
}

function targetWithinDistance(
  event: IntelligenceEvent,
  target: IntelligenceGraphNode,
  maximumDistanceKm?: number,
): boolean {
  if (maximumDistanceKm === undefined) return true;
  if (
    event.latitude === undefined ||
    event.longitude === undefined ||
    target.latitude === undefined ||
    target.longitude === undefined
  ) {
    return false;
  }
  return distanceInKilometers(
    event.latitude,
    event.longitude,
    target.latitude,
    target.longitude,
  ) <= maximumDistanceKm;
}

export function eventMatchesImpactRule(event: IntelligenceEvent, rule: ImpactRule): boolean {
  if (!rule.enabled || !rule.triggerCategories.includes(event.category)) return false;
  const text = eventText(event);
  if (rule.requiredKeywords?.length && !rule.requiredKeywords.some((keyword) => text.includes(keyword.toLocaleLowerCase("en-US")))) {
    return false;
  }
  return rule.conditions.every((condition) => conditionMatches(event, condition));
}

export interface ImpactRuleRun {
  generatedAt: string;
  rulesEvaluated: number;
  eventsEvaluated: number;
  relationships: IntelligenceRelationship[];
}

export function runImpactRules(
  events: readonly IntelligenceEvent[],
  nodes: readonly IntelligenceGraphNode[],
  rules: readonly ImpactRule[],
  generatedAt = new Date().toISOString(),
): ImpactRuleRun {
  const relationships: IntelligenceRelationship[] = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const rule of rules) {
    for (const event of events) {
      if (!eventMatchesImpactRule(event, rule)) continue;
      const sourceNode = nodes.find((node) => node.type === "event" && node.eventId === event.id);
      if (!sourceNode) continue;
      const targets = (rule.targetNodeIds ?? [])
        .map((id) => nodeById.get(id))
        .filter((target): target is IntelligenceGraphNode => Boolean(target))
        .filter((target) => rule.targetNodeTypes.includes(target.type))
        .filter((target) => targetWithinDistance(event, target, rule.maximumDistanceKm));

      for (const target of targets) {
        const officialBoost = Math.min(10, event.officialSourceCount * 3);
        const corroborationBoost = Math.min(12, Math.max(0, event.supportingSourceCount - 1) * 2);
        const contradictionPenalty = Math.min(24, event.contradictionCount * 8);
        const severityAdjustment = Math.max(0, event.severity - 2) * 2;
        const relationshipConfidence = clamp(
          rule.baseRelationshipConfidence + officialBoost + corroborationBoost + severityAdjustment - contradictionPenalty,
        );
        const exposureConfidence = rule.baseExposureConfidence === undefined
          ? undefined
          : clamp(rule.baseExposureConfidence + officialBoost - Math.floor(contradictionPenalty / 2));
        // Automatically proposed consequences deliberately cap causal confidence.
        const causalConfidence = rule.baseCausalConfidence === undefined
          ? undefined
          : Math.min(45, clamp(rule.baseCausalConfidence + officialBoost - contradictionPenalty));
        const id = `generated-${rule.id}-${event.id}-${target.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
        relationships.push({
          id,
          sourceNodeId: sourceNode.id,
          sourceNodeType: sourceNode.type,
          targetNodeId: target.id,
          targetNodeType: target.type,
          relationshipType: rule.relationshipType,
          relationshipConfidence,
          exposureConfidence,
          causalConfidence,
          supportingReportIds: event.sourceReportIds.slice(0, 4),
          contradictingReportIds: event.disputedClaims.flatMap((claim) => claim.contradictingReportIds),
          explanation: rule.explanationTemplate,
          detectionMethod: "rule",
          createdAt: generatedAt,
          lastRecalculatedAt: generatedAt,
          analystState: "needs-review",
          analystNotes: "Hypothesis — analyst review required.",
          modelVersion: MODEL_VERSION,
          dataClassification: "demonstration",
          demoDataLabel: event.demoDataLabel,
        });
      }
    }
  }

  return {
    generatedAt,
    rulesEvaluated: rules.filter((rule) => rule.enabled).length,
    eventsEvaluated: events.length,
    relationships,
  };
}

export interface RelationshipRecalculationEvidence {
  supportingReportIds: string[];
  contradictingReportIds: string[];
  occurredAt: string;
  explanation?: string;
}

export function recalculateRelationship(
  relationship: IntelligenceRelationship,
  evidence: RelationshipRecalculationEvidence,
): { relationship: IntelligenceRelationship; history: RelationshipHistoryEntry } {
  const supportDelta = evidence.supportingReportIds.length * 3;
  const contradictionDelta = evidence.contradictingReportIds.length * 7;
  const relationshipConfidence = clamp(
    relationship.relationshipConfidence + supportDelta - contradictionDelta,
  );
  const causalConfidence = relationship.causalConfidence === undefined
    ? undefined
    : clamp(relationship.causalConfidence + Math.floor(supportDelta / 2) - contradictionDelta);
  const next: IntelligenceRelationship = {
    ...relationship,
    relationshipConfidence,
    causalConfidence,
    supportingReportIds: [...new Set([...relationship.supportingReportIds, ...evidence.supportingReportIds])],
    contradictingReportIds: [...new Set([...relationship.contradictingReportIds, ...evidence.contradictingReportIds])],
    explanation: evidence.explanation ?? relationship.explanation,
    lastRecalculatedAt: evidence.occurredAt,
    analystState: evidence.contradictingReportIds.length > 0 && relationship.analystState !== "rejected"
      ? "needs-review"
      : relationship.analystState,
  };
  return {
    relationship: next,
    history: {
      id: `history-${relationship.id}-${evidence.occurredAt.replace(/\W/g, "")}`,
      relationshipId: relationship.id,
      occurredAt: evidence.occurredAt,
      relationshipConfidence,
      exposureConfidence: next.exposureConfidence,
      causalConfidence,
      marketAnomalyScore: next.marketAnomalyScore,
      analystState: next.analystState,
      explanation: next.explanation,
      supportingReportIds: next.supportingReportIds,
      contradictingReportIds: next.contradictingReportIds,
      rulesetVersion: next.modelVersion,
      actor: "system",
      dataClassification: next.dataClassification,
    },
  };
}

export interface ImpactChain {
  id: string;
  nodeIds: string[];
  relationshipIds: string[];
  minimumRelationshipConfidence: number;
  containsHypothesis: boolean;
}

export function buildImpactChains(
  relationships: readonly IntelligenceRelationship[],
  startNodeId: string,
  maximumDepth = 5,
): ImpactChain[] {
  const outgoing = new Map<string, IntelligenceRelationship[]>();
  for (const relationship of relationships) {
    const bucket = outgoing.get(relationship.sourceNodeId) ?? [];
    bucket.push(relationship);
    outgoing.set(relationship.sourceNodeId, bucket);
  }
  const chains: ImpactChain[] = [];

  function walk(nodeIds: string[], edges: IntelligenceRelationship[]): void {
    const currentNodeId = nodeIds.at(-1);
    if (!currentNodeId) return;
    const nextEdges = (outgoing.get(currentNodeId) ?? []).filter(
      (relationship) => !nodeIds.includes(relationship.targetNodeId),
    );
    if (edges.length >= maximumDepth || nextEdges.length === 0) {
      if (edges.length >= 2) {
        chains.push({
          id: `chain-${edges.map((edge) => edge.id).join("-")}`,
          nodeIds,
          relationshipIds: edges.map((edge) => edge.id),
          minimumRelationshipConfidence: Math.min(...edges.map((edge) => edge.relationshipConfidence)),
          containsHypothesis: edges.some((edge) => edge.analystState === "needs-review" || edge.relationshipType === "hypothesized-consequence"),
        });
      }
      return;
    }
    for (const edge of nextEdges) walk([...nodeIds, edge.targetNodeId], [...edges, edge]);
  }

  walk([startNodeId], []);
  return chains;
}
