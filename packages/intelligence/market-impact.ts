import type {
  AnalystRelationshipState,
  MarketImpactAssessment,
} from "@/packages/shared/types";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface MarketObservation {
  eventId: string;
  assetId: string;
  priceBefore: number;
  priceAfter: number;
  volume: number;
  averageVolume: number;
  normalVolatilityPercent: number;
  sectorChangePercent: number;
  indexChangePercent: number;
  broaderMarketChangePercent: number;
  exposureConfidence: number;
  supportingReportIds: string[];
  contradictingReportIds?: string[];
  calculatedAt: string;
  analystState?: AnalystRelationshipState;
  demoDataLabel: string;
}

export interface MarketAnomalyBreakdown {
  score: number;
  assetMovePercent: number;
  residualMovePercent: number;
  volumeChangePercent: number;
  volatilityMultiple: number;
  explanation: string[];
}

export function calculateMarketAnomaly(observation: MarketObservation): MarketAnomalyBreakdown {
  const assetMovePercent = ((observation.priceAfter - observation.priceBefore) / observation.priceBefore) * 100;
  const benchmarkMove = (observation.sectorChangePercent + observation.indexChangePercent + observation.broaderMarketChangePercent) / 3;
  const residualMovePercent = assetMovePercent - benchmarkMove;
  const volatility = Math.max(0.1, observation.normalVolatilityPercent);
  const volatilityMultiple = Math.abs(residualMovePercent) / volatility;
  const volumeChangePercent = observation.averageVolume <= 0
    ? 0
    : ((observation.volume - observation.averageVolume) / observation.averageVolume) * 100;
  const movementScore = Math.min(55, volatilityMultiple * 22);
  const volumeScore = Math.min(25, Math.max(0, volumeChangePercent) / 6);
  const exposureScore = observation.exposureConfidence * 0.2;
  const score = clamp(movementScore + volumeScore + exposureScore);
  return {
    score,
    assetMovePercent,
    residualMovePercent,
    volumeChangePercent,
    volatilityMultiple,
    explanation: [
      `Asset move: ${assetMovePercent.toFixed(2)}%.`,
      `Benchmark-adjusted move: ${residualMovePercent.toFixed(2)}%.`,
      `Volume change: ${volumeChangePercent.toFixed(0)}%.`,
      `Residual move is ${volatilityMultiple.toFixed(1)}× normal volatility.`,
    ],
  };
}

export function createMarketImpactAssessment(observation: MarketObservation): MarketImpactAssessment {
  const anomaly = calculateMarketAnomaly(observation);
  const relationshipConfidence = clamp(
    observation.exposureConfidence * 0.55 + anomaly.score * 0.35 + Math.min(10, observation.supportingReportIds.length * 3),
  );
  // Causality is intentionally conservative: timing and exposure cannot prove cause.
  const causalConfidence = clamp(
    Math.min(45, anomaly.score * 0.22 + observation.supportingReportIds.length * 4 - (observation.contradictingReportIds?.length ?? 0) * 8),
  );
  const direction = anomaly.assetMovePercent >= 0 ? "rose" : "fell";
  return {
    id: `market-${observation.eventId}-${observation.assetId}`,
    eventId: observation.eventId,
    assetId: observation.assetId,
    exposureConfidence: clamp(observation.exposureConfidence),
    relationshipConfidence,
    marketAnomalyScore: anomaly.score,
    causalConfidence,
    priceBefore: observation.priceBefore,
    priceAfter: observation.priceAfter,
    percentChange: Number(anomaly.assetMovePercent.toFixed(2)),
    volumeChangePercent: Number(anomaly.volumeChangePercent.toFixed(2)),
    normalVolatility: observation.normalVolatilityPercent,
    sectorChangePercent: observation.sectorChangePercent,
    indexChangePercent: observation.indexChangePercent,
    broaderMarketChangePercent: observation.broaderMarketChangePercent,
    supportingReportIds: observation.supportingReportIds,
    contradictingReportIds: observation.contradictingReportIds ?? [],
    explanation: anomaly.score >= 65
      ? `Possible market impact detected. The asset ${direction} unusually following the event, but direct causation has not been confirmed.`
      : `The asset ${direction} within a range that does not establish an unusual market reaction. Exposure remains informational only.`,
    analystState: observation.analystState ?? (anomaly.score >= 65 ? "needs-review" : "automated"),
    calculatedAt: observation.calculatedAt,
    modelVersion: "market-anomaly-1.0.0",
    dataClassification: "demonstration",
    demoDataLabel: observation.demoDataLabel,
  };
}
