const TRACKING_QUERY_PREFIXES = ["utm_", "mc_", "pk_"];
const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "ref",
  "referrer",
  "source",
  "campaign",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

export function normalizeWhitespace(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeText(value: string): string {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("en-US")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  const union = leftTokens.size + rightTokens.size - intersection;
  return intersection / union;
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    url.protocol = url.protocol.toLocaleLowerCase("en-US");

    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = "";
    }

    const keptParams = [...url.searchParams.entries()]
      .filter(([key]) => {
        const normalizedKey = key.toLocaleLowerCase("en-US");
        return (
          !TRACKING_QUERY_KEYS.has(normalizedKey) &&
          !TRACKING_QUERY_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
        );
      })
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        `${leftKey}=${leftValue}`.localeCompare(`${rightKey}=${rightValue}`),
      );

    url.search = "";
    for (const [key, queryValue] of keptParams) url.searchParams.append(key, queryValue);

    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return normalizeWhitespace(value).toLocaleLowerCase("en-US");
  }
}

export function sharedTerms(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right.map((value) => normalizeText(value)).filter(Boolean));
  return [...new Set(left.map((value) => normalizeText(value)).filter((value) => rightSet.has(value)))];
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function hoursBetween(left: string, right: string): number | null {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return null;
  return Math.abs(leftTime - rightTime) / 3_600_000;
}

export function distanceInKilometers(
  leftLatitude: number,
  leftLongitude: number,
  rightLatitude: number,
  rightLongitude: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKilometers = 6_371;
  const latitudeDelta = toRadians(rightLatitude - leftLatitude);
  const longitudeDelta = toRadians(rightLongitude - leftLongitude);
  const leftRadians = toRadians(leftLatitude);
  const rightRadians = toRadians(rightLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftRadians) * Math.cos(rightRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKilometers * Math.asin(Math.sqrt(haversine));
}
