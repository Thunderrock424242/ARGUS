import type {
  CloseApproach,
  EarthOrbitObject,
  ImpactRiskRecord,
  OrbitalMeanElements,
  SpaceWeatherEvent,
} from "@/packages/shared/orbital-types";

export class OrbitalSourceFormatError extends Error {
  override readonly name = "OrbitalSourceFormatError";
}

export interface ParsedOrbitalSource<T> {
  records: T[];
  sourceVersion: string;
  sourceTimestamp?: string;
}

const PUBLIC_INFORMATION_LABEL =
  "Public orbital information — verify source age and limitations";
const LUNAR_DISTANCE_AU = 0.00256955529;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 1_000);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function officialNasaUrl(value: unknown): string {
  const text = stringValue(value);
  if (!text) return "https://api.nasa.gov/";
  try {
    const url = new URL(text);
    const host = url.hostname.toLocaleLowerCase("en-US");
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && (host === "nasa.gov" || host.endsWith(".nasa.gov"))) {
      return url.toString();
    }
  } catch {
    // Invalid or non-HTTP source links are replaced with the official API root.
  }
  return "https://api.nasa.gov/";
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function integerValue(value: unknown): number | undefined {
  const parsed = numberValue(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
}

function timestampValue(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function requiredString(value: unknown, field: string): string {
  const parsed = stringValue(value);
  if (!parsed) throw new OrbitalSourceFormatError(`Orbital source field ${field} is missing.`);
  return parsed;
}

function requiredNumber(value: unknown, field: string): number {
  const parsed = numberValue(value);
  if (parsed === undefined) throw new OrbitalSourceFormatError(`Orbital source field ${field} is invalid.`);
  return parsed;
}

function normalizeOmm(input: JsonRecord): OrbitalMeanElements | null {
  const name = stringValue(input.OBJECT_NAME);
  const objectId = stringValue(input.OBJECT_ID) ?? "UNKNOWN";
  const epoch = timestampValue(input.EPOCH);
  const meanMotion = numberValue(input.MEAN_MOTION);
  const eccentricity = numberValue(input.ECCENTRICITY);
  const inclination = numberValue(input.INCLINATION);
  const raan = numberValue(input.RA_OF_ASC_NODE);
  const argument = numberValue(input.ARG_OF_PERICENTER);
  const anomaly = numberValue(input.MEAN_ANOMALY);
  const catalogId = integerValue(input.NORAD_CAT_ID);
  const elementSet = integerValue(input.ELEMENT_SET_NO);
  const bstar = numberValue(input.BSTAR);
  const motionDot = numberValue(input.MEAN_MOTION_DOT);
  const motionDdot = numberValue(input.MEAN_MOTION_DDOT);
  if (!name || !epoch || meanMotion === undefined || eccentricity === undefined || inclination === undefined || raan === undefined || argument === undefined || anomaly === undefined || catalogId === undefined || elementSet === undefined || bstar === undefined || motionDot === undefined || motionDdot === undefined) {
    return null;
  }
  return {
    OBJECT_NAME: name,
    OBJECT_ID: objectId,
    EPOCH: epoch,
    MEAN_MOTION: meanMotion,
    ECCENTRICITY: eccentricity,
    INCLINATION: inclination,
    RA_OF_ASC_NODE: raan,
    ARG_OF_PERICENTER: argument,
    MEAN_ANOMALY: anomaly,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: input.CLASSIFICATION_TYPE === "C" ? "C" : "U",
    NORAD_CAT_ID: catalogId,
    ELEMENT_SET_NO: elementSet,
    REV_AT_EPOCH: integerValue(input.REV_AT_EPOCH) ?? 0,
    BSTAR: bstar,
    MEAN_MOTION_DOT: motionDot,
    MEAN_MOTION_DDOT: motionDdot,
    OBJECT_TYPE: stringValue(input.OBJECT_TYPE),
    COUNTRY_CODE: stringValue(input.COUNTRY_CODE),
    CENTER_NAME: "EARTH",
    REF_FRAME: "TEME",
    TIME_SYSTEM: "UTC",
    MEAN_ELEMENT_THEORY: "SGP4",
  };
}

function objectType(value: unknown): EarthOrbitObject["objectType"] {
  const normalized = stringValue(value)?.toLocaleUpperCase("en-US");
  if (normalized === "PAYLOAD") return "payload";
  if (normalized === "ROCKET BODY") return "rocket-body";
  if (normalized === "DEBRIS") return "debris";
  return "unknown";
}

function orbitClass(meanMotion: number, eccentricity: number): EarthOrbitObject["orbitClass"] {
  if (eccentricity >= 0.25) return "HEO";
  if (meanMotion >= 10) return "LEO";
  if (meanMotion >= 1.1) return "MEO";
  if (meanMotion >= 0.9 && meanMotion <= 1.1) return "GEO";
  return "other";
}

export function parseCelestrakOmm(payload: unknown, now = new Date()): ParsedOrbitalSource<EarthOrbitObject> {
  if (!Array.isArray(payload)) throw new OrbitalSourceFormatError("CelesTrak OMM payload must be an array.");
  const normalized = records(payload).slice(0, 500).flatMap((item) => {
    const elements = normalizeOmm(item);
    if (!elements) return [];
    const catalogId = String(elements.NORAD_CAT_ID);
    const ageMs = now.getTime() - Date.parse(elements.EPOCH);
    const stale = !Number.isFinite(ageMs) || ageMs > 3.5 * 86_400_000;
    const meanMotion = Number(elements.MEAN_MOTION);
    const eccentricity = Number(elements.ECCENTRICITY);
    return [{
      id: `celestrak:${catalogId}`,
      name: elements.OBJECT_NAME,
      noradCatalogId: catalogId,
      internationalDesignator: elements.OBJECT_ID === "UNKNOWN" ? undefined : elements.OBJECT_ID,
      objectType: objectType(item.OBJECT_TYPE),
      orbitClass: orbitClass(meanMotion, eccentricity),
      elementEpoch: elements.EPOCH,
      attentionState: stale ? "stale" as const : "information" as const,
      attentionReason: stale
        ? "The published element set is older than the reviewed freshness threshold."
        : "Position is propagated from a current published GP element set.",
      sourceId: "celestrak-stations" as const,
      sourceUrl: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(catalogId)}&FORMAT=JSON`,
      elements,
      dataClassification: "public-information" as const,
      demoDataLabel: PUBLIC_INFORMATION_LABEL,
    }];
  });
  if (!normalized.length) throw new OrbitalSourceFormatError("CelesTrak returned no usable OMM records.");
  return {
    records: normalized.slice(0, 100),
    sourceVersion: "CelesTrak OMM JSON",
    sourceTimestamp: normalized.reduce((latest, item) => item.elementEpoch > latest ? item.elementEpoch : latest, normalized[0].elementEpoch),
  };
}

function signature(payload: unknown, expectedVersion: string, expectedSource: RegExp): JsonRecord {
  const root = record(payload);
  const value = record(root?.signature);
  if (!root || !value || stringValue(value.version) !== expectedVersion || !expectedSource.test(stringValue(value.source) ?? "")) {
    throw new OrbitalSourceFormatError(`NASA/JPL source signature did not match version ${expectedVersion}.`);
  }
  return root;
}

export function parseJplCloseApproaches(payload: unknown): ParsedOrbitalSource<CloseApproach> {
  const root = signature(payload, "1.5", /NASA\/JPL.*Close.?Approach/i);
  if (!Array.isArray(root.fields) || !Array.isArray(root.data)) {
    throw new OrbitalSourceFormatError("NASA/JPL close-approach payload shape is invalid.");
  }
  const fields = root.fields.map(stringValue);
  const requiredFields = ["des", "orbit_id", "jd", "cd", "dist", "dist_min", "dist_max", "v_rel"];
  if (requiredFields.some((required) => !fields.includes(required))) {
    throw new OrbitalSourceFormatError("NASA/JPL close-approach fields do not match the reviewed schema.");
  }
  const rows = root.data.filter(Array.isArray).slice(0, 500);
  const indexes = new Map(fields.flatMap((field, index) => field ? [[field, index] as const] : []));
  const field = (row: unknown[], name: string): unknown => {
    const index = indexes.get(name);
    return index === undefined ? undefined : row[index];
  };
  const parsed = rows.flatMap((row) => {
    try {
      const designation = requiredString(field(row, "des"), "des");
      const orbitId = requiredString(field(row, "orbit_id"), "orbit_id");
      const julianDate = requiredNumber(field(row, "jd"), "jd");
      const nominalDistanceAu = requiredNumber(field(row, "dist"), "dist");
      const minimumDistanceAu = requiredNumber(field(row, "dist_min"), "dist_min");
      const maximumDistanceAu = requiredNumber(field(row, "dist_max"), "dist_max");
      return [{
        id: `jpl-cad:${designation}:${orbitId}:${julianDate}`,
        designation,
        fullName: stringValue(field(row, "fullname")) ?? designation,
        orbitId,
        closeApproachTime: requiredString(field(row, "cd"), "cd"),
        timeSystem: "TDB" as const,
        julianDate,
        nominalDistanceAu,
        minimumDistanceAu,
        maximumDistanceAu,
        nominalDistanceLunar: nominalDistanceAu / LUNAR_DISTANCE_AU,
        relativeVelocityKmS: requiredNumber(field(row, "v_rel"), "v_rel"),
        absoluteMagnitude: numberValue(field(row, "h")),
        diameterKm: numberValue(field(row, "diameter")),
        diameterSigmaKm: numberValue(field(row, "diameter_sigma")),
        timeUncertainty: stringValue(field(row, "t_sigma_f")) ?? "unknown",
        attentionState: "information" as const,
        attentionReason: "Published close approach; proximity is not an impact prediction.",
        sourceId: "jpl-close-approaches" as const,
        sourceUrl: `https://ssd-api.jpl.nasa.gov/cad.api?des=${encodeURIComponent(designation)}`,
        dataClassification: "public-information" as const,
        demoDataLabel: PUBLIC_INFORMATION_LABEL,
      }];
    } catch {
      return [];
    }
  });
  return { records: parsed.slice(0, 100), sourceVersion: "1.5" };
}

export function parseJplSentry(payload: unknown): ParsedOrbitalSource<ImpactRiskRecord> {
  const root = signature(payload, "2.0", /NASA\/JPL.*Sentry/i);
  if (!Array.isArray(root.data)) {
    throw new OrbitalSourceFormatError("NASA/JPL Sentry payload shape is invalid.");
  }
  const parsed = records(root.data).slice(0, 1_000).flatMap((item) => {
    const designation = stringValue(item.des);
    const sentryId = stringValue(item.id);
    const probability = numberValue(item.ip);
    const count = integerValue(item.n_imp);
    const torino = numberValue(item.ts_max);
    const palermo = numberValue(item.ps_max);
    const cumulativePalermo = numberValue(item.ps_cum);
    if (!designation || !sentryId || probability === undefined || count === undefined || torino === undefined || palermo === undefined || cumulativePalermo === undefined) return [];
    const elevated = torino > 0 || cumulativePalermo >= 0;
    return [{
      id: `jpl-sentry:${sentryId}`,
      designation,
      fullName: stringValue(item.fullname) ?? designation,
      sentryId,
      impactProbability: probability,
      potentialImpactCount: count,
      maximumTorino: torino,
      maximumPalermo: palermo,
      cumulativePalermo,
      potentialImpactRange: stringValue(item.range) ?? "not supplied",
      lastObservationDate: stringValue(item.last_obs),
      diameterKm: numberValue(item.diameter),
      absoluteMagnitude: numberValue(item.h),
      attentionState: elevated ? "elevated" as const : "watch" as const,
      attentionReason: elevated
        ? "An official Sentry scale value crosses the reviewed display threshold; this remains a probabilistic monitoring result."
        : "Object is listed by Sentry for continued impact monitoring; this is not an expected impact.",
      sourceId: "jpl-sentry" as const,
      sourceUrl: `https://ssd-api.jpl.nasa.gov/sentry.api?des=${encodeURIComponent(designation)}`,
      dataClassification: "public-information" as const,
      demoDataLabel: PUBLIC_INFORMATION_LABEL,
    }];
  }).sort((left, right) => right.maximumTorino - left.maximumTorino || right.cumulativePalermo - left.cumulativePalermo);
  return { records: parsed.slice(0, 250), sourceVersion: "2.0" };
}

function linkedIds(value: unknown): string[] {
  return records(value).slice(0, 50).map((item) => stringValue(item.activityID)).filter((item): item is string => Boolean(item));
}

export function parseDonkiEvents(payload: { cme: unknown; flares: unknown; storms: unknown }): ParsedOrbitalSource<SpaceWeatherEvent> {
  if (!Array.isArray(payload.cme) || !Array.isArray(payload.flares) || !Array.isArray(payload.storms)) {
    throw new OrbitalSourceFormatError("NASA DONKI payload shape is invalid.");
  }
  const cmes: SpaceWeatherEvent[] = records(payload.cme).slice(0, 500).flatMap((item) => {
    const id = stringValue(item.activityID);
    const startedAt = timestampValue(item.startTime);
    if (!id || !startedAt) return [];
    const analysis = records(item.cmeAnalyses).find((candidate) => candidate.isMostAccurate === true) ?? records(item.cmeAnalyses)[0];
    return [{
      id: `donki:cme:${id}`,
      type: "cme",
      title: `Coronal mass ejection ${id}`,
      summary: stringValue(item.note) ?? "NASA DONKI coronal mass ejection record.",
      startedAt,
      speedKmS: numberValue(analysis?.speed),
      sourceLocation: stringValue(item.sourceLocation),
      activeRegionNumber: integerValue(item.activeRegionNum),
      attentionState: "information",
      attentionReason: "Published DONKI event; model output and observed arrival remain distinct.",
      sourceId: "nasa-donki",
      sourceUrl: officialNasaUrl(item.link),
      linkedEventIds: linkedIds(item.linkedEvents),
      dataClassification: "public-information",
      demoDataLabel: PUBLIC_INFORMATION_LABEL,
    }];
  });
  const flares: SpaceWeatherEvent[] = records(payload.flares).slice(0, 500).flatMap((item) => {
    const id = stringValue(item.flrID);
    const startedAt = timestampValue(item.beginTime);
    if (!id || !startedAt) return [];
    return [{
      id: `donki:flare:${id}`,
      type: "solar-flare",
      title: `${stringValue(item.classType) ?? "Solar"} flare ${id}`,
      summary: "NASA DONKI solar flare observation.",
      startedAt,
      peakAt: timestampValue(item.peakTime),
      endedAt: timestampValue(item.endTime),
      classType: stringValue(item.classType),
      sourceLocation: stringValue(item.sourceLocation),
      activeRegionNumber: integerValue(item.activeRegionNum),
      attentionState: "information",
      attentionReason: "Published flare observation; no ARGUS operational severity has been inferred.",
      sourceId: "nasa-donki",
      sourceUrl: officialNasaUrl(item.link),
      linkedEventIds: linkedIds(item.linkedEvents),
      dataClassification: "public-information",
      demoDataLabel: PUBLIC_INFORMATION_LABEL,
    }];
  });
  const storms: SpaceWeatherEvent[] = records(payload.storms).slice(0, 500).flatMap((item) => {
    const id = stringValue(item.gstID);
    const startedAt = timestampValue(item.startTime);
    if (!id || !startedAt) return [];
    const maximumKp = records(item.allKpIndex).reduce((maximum, entry) => Math.max(maximum, numberValue(entry.kpIndex) ?? 0), 0);
    return [{
      id: `donki:storm:${id}`,
      type: "geomagnetic-storm",
      title: `Geomagnetic storm ${id}`,
      summary: maximumKp ? `NASA DONKI geomagnetic-storm record; maximum published Kp ${maximumKp}.` : "NASA DONKI geomagnetic-storm record.",
      startedAt,
      classType: maximumKp ? `Kp ${maximumKp}` : undefined,
      attentionState: "information",
      attentionReason: "Published DONKI storm record; no separate ARGUS warning has been inferred.",
      sourceId: "nasa-donki",
      sourceUrl: officialNasaUrl(item.link),
      linkedEventIds: linkedIds(item.linkedEvents),
      dataClassification: "public-information",
      demoDataLabel: PUBLIC_INFORMATION_LABEL,
    }];
  });
  const combined = [...cmes, ...flares, ...storms]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, 200);
  return {
    records: combined,
    sourceVersion: "DONKI",
    sourceTimestamp: combined[0]?.startedAt,
  };
}
