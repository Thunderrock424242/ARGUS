import type {
  CloseApproach,
  EarthOrbitObject,
  ImpactRiskRecord,
  OrbitalSnapshot,
  OrbitalSourceStatus,
  SpaceWeatherEvent,
} from "./orbital-types";

export const ORBITAL_DEMONSTRATION_LABEL =
  "Demonstration orbital data — not real-world tracking";

const DAY_MS = 86_400_000;

function isoAt(base: Date, offsetMs: number): string {
  return new Date(base.getTime() + offsetMs).toISOString();
}

function source(
  id: OrbitalSourceStatus["id"],
  name: string,
  organization: string,
  sourceUrl: string,
  recordCount: number,
  now: Date,
): OrbitalSourceStatus {
  return {
    id,
    name,
    organization,
    sourceUrl,
    status: "fixture",
    lastAttemptAt: now.toISOString(),
    lastSuccessfulAt: now.toISOString(),
    recordCount,
    message: "Fictional fixture fallback. No external source was contacted.",
    dataClassification: "demonstration",
  };
}

function demoSatellite(
  input: {
    id: string;
    name: string;
    catalogId: number;
    objectId: string;
    orbitClass: EarthOrbitObject["orbitClass"];
    meanMotion: number;
    eccentricity: number;
    inclination: number;
    raan: number;
    argument: number;
    anomaly: number;
  },
  now: Date,
): EarthOrbitObject {
  const epoch = isoAt(now, -35 * 60_000);
  return {
    id: input.id,
    name: `[DEMO] ${input.name}`,
    noradCatalogId: String(input.catalogId),
    internationalDesignator: input.objectId,
    objectType: "payload",
    orbitClass: input.orbitClass,
    elementEpoch: epoch,
    attentionState: "information",
    attentionReason: "Fresh fictional element set available for interface testing.",
    sourceId: "celestrak-stations",
    sourceUrl: "https://celestrak.org/NORAD/elements/",
    elements: {
      OBJECT_NAME: `[DEMO] ${input.name}`,
      OBJECT_ID: input.objectId,
      EPOCH: epoch,
      MEAN_MOTION: input.meanMotion,
      ECCENTRICITY: input.eccentricity,
      INCLINATION: input.inclination,
      RA_OF_ASC_NODE: input.raan,
      ARG_OF_PERICENTER: input.argument,
      MEAN_ANOMALY: input.anomaly,
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: "U",
      NORAD_CAT_ID: input.catalogId,
      ELEMENT_SET_NO: 1,
      REV_AT_EPOCH: 100,
      BSTAR: 0.00008,
      MEAN_MOTION_DOT: 0.00001,
      MEAN_MOTION_DDOT: 0,
      OBJECT_TYPE: "PAYLOAD",
      CENTER_NAME: "EARTH",
      REF_FRAME: "TEME",
      TIME_SYSTEM: "UTC",
      MEAN_ELEMENT_THEORY: "SGP4",
    },
    dataClassification: "demonstration",
    demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
  };
}

export function createDemoOrbitalSnapshot(now = new Date()): OrbitalSnapshot {
  const earthOrbitObjects: EarthOrbitObject[] = [
    demoSatellite({ id: "demo-sat-meridian", name: "Meridian Research Station", catalogId: 90001, objectId: "2026-901A", orbitClass: "LEO", meanMotion: 15.49, eccentricity: 0.00042, inclination: 51.64, raan: 87.1, argument: 44.2, anomaly: 120.6 }, now),
    demoSatellite({ id: "demo-sat-aurora", name: "Aurora Weather 1", catalogId: 90002, objectId: "2026-902A", orbitClass: "LEO", meanMotion: 14.21, eccentricity: 0.0011, inclination: 98.72, raan: 201.3, argument: 12.8, anomaly: 251.4 }, now),
    demoSatellite({ id: "demo-sat-wayfinder", name: "Wayfinder Navigation 3", catalogId: 90003, objectId: "2026-903A", orbitClass: "MEO", meanMotion: 2.0056, eccentricity: 0.0062, inclination: 55.1, raan: 315.7, argument: 87.5, anomaly: 14.1 }, now),
    demoSatellite({ id: "demo-sat-relay", name: "Sentinel Relay", catalogId: 90004, objectId: "2026-904A", orbitClass: "GEO", meanMotion: 1.0027, eccentricity: 0.00018, inclination: 0.08, raan: 149.2, argument: 180, anomaly: 44 }, now),
  ];

  const closeApproaches: CloseApproach[] = [
    {
      id: "demo-ca-2026-qx1",
      designation: "2026 QX1",
      fullName: "[DEMO] 2026 QX1",
      orbitId: "demo-18",
      closeApproachTime: isoAt(now, 3 * DAY_MS),
      timeSystem: "TDB",
      julianDate: 2_461_000.5,
      nominalDistanceAu: 0.0184,
      minimumDistanceAu: 0.0181,
      maximumDistanceAu: 0.0187,
      nominalDistanceLunar: 7.16,
      relativeVelocityKmS: 12.7,
      absoluteMagnitude: 24.8,
      diameterKm: 0.038,
      timeUncertainty: "00:08",
      attentionState: "information",
      attentionReason: "Fictional close approach; no impact prediction.",
      sourceId: "jpl-close-approaches",
      sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/cad.html",
      dataClassification: "demonstration",
      demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
    },
    {
      id: "demo-ca-2026-vesta",
      designation: "2026 VT4",
      fullName: "[DEMO] 2026 VT4",
      orbitId: "demo-7",
      closeApproachTime: isoAt(now, 11 * DAY_MS),
      timeSystem: "TDB",
      julianDate: 2_461_008.5,
      nominalDistanceAu: 0.042,
      minimumDistanceAu: 0.0406,
      maximumDistanceAu: 0.0434,
      nominalDistanceLunar: 16.35,
      relativeVelocityKmS: 7.9,
      absoluteMagnitude: 21.6,
      diameterKm: 0.17,
      timeUncertainty: "01:21",
      attentionState: "watch",
      attentionReason: "Fictional analyst watchlist match; proximity alone is not a threat.",
      sourceId: "jpl-close-approaches",
      sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/cad.html",
      dataClassification: "demonstration",
      demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
    },
  ];

  const impactRisks: ImpactRiskRecord[] = [
    {
      id: "demo-risk-2026-vt4",
      designation: "2026 VT4",
      fullName: "[DEMO] 2026 VT4",
      sentryId: "demo-sentry-vt4",
      impactProbability: 0.00000023,
      potentialImpactCount: 2,
      maximumTorino: 0,
      maximumPalermo: -3.4,
      cumulativePalermo: -3.1,
      potentialImpactRange: "2078-2110",
      lastObservationDate: isoAt(now, -2 * DAY_MS).slice(0, 10),
      diameterKm: 0.17,
      absoluteMagnitude: 21.6,
      attentionState: "watch",
      attentionReason: "Fictional Sentry-style monitoring record; not an expected impact.",
      sourceId: "jpl-sentry",
      sourceUrl: "https://ssd-api.jpl.nasa.gov/doc/sentry.html",
      dataClassification: "demonstration",
      demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
    },
  ];

  const spaceWeatherEvents: SpaceWeatherEvent[] = [
    {
      id: "demo-flare-1",
      type: "solar-flare",
      title: "[DEMO] M2.4 solar flare observed",
      summary: "Fictional flare record used to exercise the solar activity timeline.",
      startedAt: isoAt(now, -4 * 60 * 60_000),
      peakAt: isoAt(now, -3.7 * 60 * 60_000),
      endedAt: isoAt(now, -3.2 * 60 * 60_000),
      classType: "M2.4",
      sourceLocation: "N18E24",
      activeRegionNumber: 9901,
      attentionState: "information",
      attentionReason: "Fictional observation with no derived operational warning.",
      sourceId: "nasa-donki",
      sourceUrl: "https://api.nasa.gov/",
      linkedEventIds: [],
      dataClassification: "demonstration",
      demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
    },
    {
      id: "demo-cme-1",
      type: "cme",
      title: "[DEMO] Coronal mass ejection modeled",
      summary: "Fictional CME analysis for renderer and source-label testing; not an Earth-impact forecast.",
      startedAt: isoAt(now, -10 * 60 * 60_000),
      speedKmS: 684,
      sourceLocation: "S12W08",
      attentionState: "watch",
      attentionReason: "Fictional watchlist condition; model output is not an observed arrival.",
      sourceId: "nasa-donki",
      sourceUrl: "https://api.nasa.gov/",
      linkedEventIds: ["demo-flare-1"],
      dataClassification: "demonstration",
      demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
    },
  ];

  return {
    generatedAt: now.toISOString(),
    dataClassification: "demonstration",
    demoDataLabel: ORBITAL_DEMONSTRATION_LABEL,
    earthOrbitObjects,
    closeApproaches,
    impactRisks,
    spaceWeatherEvents,
    sources: [
      source("celestrak-stations", "CelesTrak stations GP", "CelesTrak", "https://celestrak.org/NORAD/elements/", earthOrbitObjects.length, now),
      source("jpl-close-approaches", "SBDB close approaches", "NASA/JPL CNEOS", "https://ssd-api.jpl.nasa.gov/doc/cad.html", closeApproaches.length, now),
      source("jpl-sentry", "Sentry impact monitoring", "NASA/JPL CNEOS", "https://ssd-api.jpl.nasa.gov/doc/sentry.html", impactRisks.length, now),
      source("nasa-donki", "DONKI space weather", "NASA", "https://api.nasa.gov/", spaceWeatherEvents.length, now),
    ],
  };
}

