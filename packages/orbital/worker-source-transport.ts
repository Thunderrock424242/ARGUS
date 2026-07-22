import {
  OrbitalSourceFormatError,
  parseCelestrakOmm,
  parseDonkiEvents,
  parseJplCloseApproaches,
  parseJplSentry,
  type ParsedOrbitalSource,
} from "./parsers";
import type {
  CloseApproach,
  EarthOrbitObject,
  ImpactRiskRecord,
  OrbitalSourceStatus,
  SpaceWeatherEvent,
} from "@/packages/shared/orbital-types";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class OrbitalSourceRequestError extends Error {
  override readonly name = "OrbitalSourceRequestError";
}

export type OrbitalSourceFetchResult =
  | ({ sourceId: "celestrak-stations" } & ParsedOrbitalSource<EarthOrbitObject>)
  | ({ sourceId: "jpl-close-approaches" } & ParsedOrbitalSource<CloseApproach>)
  | ({ sourceId: "jpl-sentry" } & ParsedOrbitalSource<ImpactRiskRecord>)
  | ({ sourceId: "nasa-donki" } & ParsedOrbitalSource<SpaceWeatherEvent>);

async function boundedText(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new OrbitalSourceRequestError("Orbital source response exceeded the configured byte limit.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("orbital-response-too-large");
        throw new OrbitalSourceRequestError("Orbital source response exceeded the configured byte limit.");
      }
      output += decoder.decode(part.value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function expectedEndpoint(url: URL): boolean {
  const host = url.hostname.toLocaleLowerCase("en-US");
  if (host === "celestrak.org") return url.pathname === "/NORAD/elements/gp.php";
  if (host === "ssd-api.jpl.nasa.gov") return url.pathname === "/cad.api" || url.pathname === "/sentry.api";
  if (host === "api.nasa.gov") return url.pathname.startsWith("/DONKI/");
  return false;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface OrbitalSourceTransport {
  fetchSource(sourceId: OrbitalSourceStatus["id"], now: Date): Promise<OrbitalSourceFetchResult>;
}

export class WorkerOrbitalSourceTransport implements OrbitalSourceTransport {
  constructor(private readonly options: { fetcher?: Fetcher; nasaApiKey?: string } = {}) {}

  private async json(urlValue: string, maximumBytes: number): Promise<unknown> {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" || !expectedEndpoint(url) || url.username || url.password || url.port) {
      throw new OrbitalSourceRequestError("Orbital source destination is not an approved fixed HTTPS endpoint.");
    }
    const response = await (this.options.fetcher ?? fetch)(url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "ARGUS/0.1 public orbital awareness" },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel("orbital-redirect-rejected");
      throw new OrbitalSourceRequestError("Orbital source redirects are not permitted.");
    }
    if (!response.ok) {
      await response.body?.cancel("orbital-upstream-error");
      throw new OrbitalSourceRequestError(`Orbital source returned HTTP ${response.status}.`);
    }
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
    if (contentType !== "application/json" && contentType !== "text/json" && contentType !== "text/plain") {
      await response.body?.cancel("orbital-content-type-rejected");
      throw new OrbitalSourceRequestError("Orbital source returned an unsupported content type.");
    }
    const text = await boundedText(response, maximumBytes);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new OrbitalSourceFormatError("Orbital source returned invalid JSON.");
    }
  }

  async fetchSource(sourceId: OrbitalSourceStatus["id"], now: Date): Promise<OrbitalSourceFetchResult> {
    if (sourceId === "celestrak-stations") {
      const parsed = parseCelestrakOmm(await this.json("https://celestrak.org/NORAD/elements/gp.php?GROUP=STATIONS&FORMAT=JSON", 2_000_000), now);
      return { sourceId, ...parsed };
    }
    if (sourceId === "jpl-close-approaches") {
      const parsed = parseJplCloseApproaches(await this.json("https://ssd-api.jpl.nasa.gov/cad.api?date-min=now&date-max=%2B60&dist-max=0.05&diameter=true&fullname=true&limit=100", 2_000_000));
      return { sourceId, ...parsed };
    }
    if (sourceId === "jpl-sentry") {
      const parsed = parseJplSentry(await this.json("https://ssd-api.jpl.nasa.gov/sentry.api", 3_000_000));
      return { sourceId, ...parsed };
    }
    if (!this.options.nasaApiKey) {
      throw new OrbitalSourceRequestError("NASA_API_KEY is not configured for DONKI.");
    }
    const startDate = utcDate(new Date(now.getTime() - 7 * 86_400_000));
    const endDate = utcDate(now);
    const key = encodeURIComponent(this.options.nasaApiKey);
    const cme = await this.json(`https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${key}`, 2_000_000);
    const flares = await this.json(`https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${key}`, 2_000_000);
    const storms = await this.json(`https://api.nasa.gov/DONKI/GST?startDate=${startDate}&endDate=${endDate}&api_key=${key}`, 2_000_000);
    return { sourceId, ...parseDonkiEvents({ cme, flares, storms }) };
  }
}

