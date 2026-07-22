import type { OMMJsonObject } from "satellite.js";
import type { DemoDataClassification } from "./types";

export type OrbitalMode = "earth-orbit" | "near-earth" | "solar-activity";
export type OrbitalAttentionState = "information" | "watch" | "elevated" | "stale" | "unknown";
export type OrbitalSnapshotClassification = DemoDataClassification | "mixed";

export interface OrbitalSourceStatus {
  id: "celestrak-stations" | "jpl-close-approaches" | "jpl-sentry" | "nasa-donki";
  name: string;
  organization: string;
  sourceUrl: string;
  status: "online" | "degraded" | "stale" | "disabled" | "fixture" | "unavailable";
  lastAttemptAt?: string;
  lastSuccessfulAt?: string;
  nextRefreshAt?: string;
  sourceVersion?: string;
  recordCount: number;
  message: string;
  dataClassification: DemoDataClassification;
}

export type OrbitalMeanElements = OMMJsonObject;

export interface EarthOrbitObject {
  id: string;
  name: string;
  noradCatalogId: string;
  internationalDesignator?: string;
  objectType: "payload" | "rocket-body" | "debris" | "unknown";
  orbitClass: "LEO" | "MEO" | "GEO" | "HEO" | "other";
  elementEpoch: string;
  attentionState: OrbitalAttentionState;
  attentionReason: string;
  sourceId: OrbitalSourceStatus["id"];
  sourceUrl: string;
  elements: OrbitalMeanElements;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface CloseApproach {
  id: string;
  designation: string;
  fullName: string;
  orbitId: string;
  closeApproachTime: string;
  timeSystem: "TDB";
  julianDate: number;
  nominalDistanceAu: number;
  minimumDistanceAu: number;
  maximumDistanceAu: number;
  nominalDistanceLunar: number;
  relativeVelocityKmS: number;
  absoluteMagnitude?: number;
  diameterKm?: number;
  diameterSigmaKm?: number;
  timeUncertainty: string;
  attentionState: OrbitalAttentionState;
  attentionReason: string;
  sourceId: OrbitalSourceStatus["id"];
  sourceUrl: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface ImpactRiskRecord {
  id: string;
  designation: string;
  fullName: string;
  sentryId: string;
  impactProbability: number;
  potentialImpactCount: number;
  maximumTorino: number;
  maximumPalermo: number;
  cumulativePalermo: number;
  potentialImpactRange: string;
  lastObservationDate?: string;
  diameterKm?: number;
  absoluteMagnitude?: number;
  attentionState: OrbitalAttentionState;
  attentionReason: string;
  sourceId: OrbitalSourceStatus["id"];
  sourceUrl: string;
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export type SpaceWeatherEventType = "cme" | "solar-flare" | "geomagnetic-storm";

export interface SpaceWeatherEvent {
  id: string;
  type: SpaceWeatherEventType;
  title: string;
  summary: string;
  startedAt: string;
  peakAt?: string;
  endedAt?: string;
  classType?: string;
  speedKmS?: number;
  sourceLocation?: string;
  activeRegionNumber?: number;
  attentionState: OrbitalAttentionState;
  attentionReason: string;
  sourceId: OrbitalSourceStatus["id"];
  sourceUrl: string;
  linkedEventIds: string[];
  dataClassification: DemoDataClassification;
  demoDataLabel: string;
}

export interface OrbitalSnapshot {
  generatedAt: string;
  dataClassification: OrbitalSnapshotClassification;
  demoDataLabel: string;
  earthOrbitObjects: EarthOrbitObject[];
  closeApproaches: CloseApproach[];
  impactRisks: ImpactRiskRecord[];
  spaceWeatherEvents: SpaceWeatherEvent[];
  sources: OrbitalSourceStatus[];
}

