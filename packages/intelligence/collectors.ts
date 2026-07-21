import type {
  CollectedReport,
  CollectorContext,
  IntelligenceCollector,
} from "@/packages/shared/types";
import { isForbiddenNetworkAddress } from "@/lib/security/public-url";
import { normalizeWhitespace } from "./text";

export const COLLECTOR_DEMO_LABEL = "Demonstration data — not real-world intelligence";

export type CollectorExecutionMode = "dry-run" | "live";

export interface CollectorTransportRequest {
  url: string;
  headers: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  timeoutMs: number;
  maximumResponseBytes: number;
  redirectPolicy: "error";
}

export interface CollectorTransportResponse {
  status: number;
  finalUrl: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  /** Used by non-Workers transports that can expose the connected address. */
  resolvedAddress?: string;
  /** Workers cannot expose a connected IP; the trusted transport instead enforces fixed host/path rules. */
  securityPolicy?: "fixed-official-endpoint";
}

/**
 * A server-side transport is deliberately injected. Collectors never call the
 * ambient fetch implementation, which keeps dry-run mode network-free and lets
 * a production runner enforce DNS pinning, egress policy, and rate limits.
 */
export interface CollectorTransport {
  request(request: CollectorTransportRequest): Promise<CollectorTransportResponse>;
}

export interface CollectorAdapterOptions {
  mode?: CollectorExecutionMode;
  transport?: CollectorTransport;
  endpoint?: string;
  maximumReports?: number;
  timeoutMs?: number;
  maximumResponseBytes?: number;
}

export class CollectorConfigurationError extends Error {
  override readonly name = "CollectorConfigurationError";
}

export class CollectorResponseError extends Error {
  override readonly name = "CollectorResponseError";
}

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLocaleLowerCase("en-US").replace(/\.$/, "");
}

export function assertPublicHttpsUrl(value: string, allowedHosts?: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CollectorConfigurationError("Collector endpoint is not a valid absolute URL.");
  }

  if (url.protocol !== "https:") {
    throw new CollectorConfigurationError("Collector endpoints must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new CollectorConfigurationError("Collector endpoint credentials are forbidden in URLs.");
  }
  if (url.port && url.port !== "443") {
    throw new CollectorConfigurationError("Collector endpoints may only use the standard HTTPS port.");
  }

  const hostname = normalizeHost(url.hostname);
  const isDirectIpAddress = hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    isDirectIpAddress ||
    isForbiddenNetworkAddress(hostname)
  ) {
    throw new CollectorConfigurationError("Collector endpoint resolves to a forbidden local or private host.");
  }

  if (allowedHosts?.length) {
    const normalizedAllowedHosts = allowedHosts.map(normalizeHost);
    const allowed = normalizedAllowedHosts.some((allowedHost) => hostname === allowedHost);
    if (!allowed) {
      throw new CollectorConfigurationError(`Collector endpoint host ${hostname} is not allowlisted.`);
    }
  }

  return url;
}

function ensureResolvedAddressIsPublic(address: string | undefined): void {
  if (!address) {
    throw new CollectorResponseError(
      "Collector transport did not report its resolved address; DNS-rebinding validation cannot continue.",
    );
  }
  const normalized = normalizeHost(address);
  if (isForbiddenNetworkAddress(normalized) || normalized === "localhost") {
    throw new CollectorResponseError("Collector transport connected to a private or local address.");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? normalizeWhitespace(value) : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isoTimestamp(value: unknown, fallback: string): string {
  const numericOrString = typeof value === "number" || typeof value === "string" ? value : fallback;
  const date = new Date(numericOrString);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function decodeXml(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^<!\[CDATA\[|\]\]>$/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, "&"),
  );
}

function xmlTag(fragment: string, names: readonly string[]): string | undefined {
  for (const name of names) {
    const match = fragment.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match?.[1]) return decodeXml(match[1]);
  }
  return undefined;
}

function atomLink(fragment: string): string | undefined {
  return fragment.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];
}

abstract class SafeStructuredCollector implements IntelligenceCollector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: IntelligenceCollector["type"];
  protected abstract readonly defaultEndpoint: string;
  protected abstract readonly allowedHosts: readonly string[];
  protected abstract parse(body: string, context: CollectorContext): CollectedReport[];
  protected abstract dryRunTitle(context: CollectorContext): string;

  protected readonly options: Required<
    Pick<
      CollectorAdapterOptions,
      "mode" | "maximumReports" | "timeoutMs" | "maximumResponseBytes"
    >
  > &
    Pick<CollectorAdapterOptions, "transport" | "endpoint">;

  constructor(options: CollectorAdapterOptions = {}) {
    this.options = {
      mode: options.mode ?? "dry-run",
      maximumReports: Math.min(500, Math.max(1, options.maximumReports ?? 100)),
      timeoutMs: Math.min(30_000, Math.max(1_000, options.timeoutMs ?? 10_000)),
      maximumResponseBytes: Math.min(
        10_000_000,
        Math.max(1_024, options.maximumResponseBytes ?? 2_000_000),
      ),
      transport: options.transport,
      endpoint: options.endpoint,
    };
  }

  protected endpoint(context: CollectorContext): string {
    void context;
    return this.options.endpoint ?? this.defaultEndpoint;
  }

  protected requestHeaders(): Readonly<Record<string, string>> {
    return {
      accept: "application/json, application/geo+json, application/xml, text/xml;q=0.9",
      "user-agent": "ARGUS/0.1 public-information collector (operator contact required before live use)",
    };
  }

  protected dryRun(context: CollectorContext): CollectedReport[] {
    return [
      {
        externalId: `argus-demo-${this.id}-${context.requestId}`,
        url: `https://demo.invalid/argus/${encodeURIComponent(this.id)}/${encodeURIComponent(context.requestId)}`,
        title: `[FICTIONAL DEMO] ${this.dryRunTitle(context)}`,
        description: `${COLLECTOR_DEMO_LABEL}. Synthetic dry-run output from ${this.name}; it is not a real alert or observation.`,
        language: "en",
        publishedAt: isoTimestamp(context.requestedAt, new Date(0).toISOString()),
        rawPayload: {
          demonstration: true,
          demoDataLabel: COLLECTOR_DEMO_LABEL,
          collectorId: this.id,
          requestId: context.requestId,
          networkAccessed: false,
        },
      },
    ];
  }

  async collect(context: CollectorContext): Promise<CollectedReport[]> {
    if (context.signal?.aborted) throw new DOMException("Collector request was aborted.", "AbortError");
    if (!context.source.enabled) return [];
    if (this.options.mode === "dry-run") return this.dryRun(context);
    if (!this.options.transport) {
      throw new CollectorConfigurationError(
        `${this.name} is in live mode but no security-enforcing server transport was provided.`,
      );
    }

    const endpoint = this.endpoint(context);
    assertPublicHttpsUrl(endpoint, this.allowedHosts);
    const response = await this.options.transport.request({
      url: endpoint,
      headers: this.requestHeaders(),
      signal: context.signal,
      timeoutMs: this.options.timeoutMs,
      maximumResponseBytes: this.options.maximumResponseBytes,
      redirectPolicy: "error",
    });
    assertPublicHttpsUrl(response.finalUrl, this.allowedHosts);
    if (response.securityPolicy !== "fixed-official-endpoint") {
      ensureResolvedAddressIsPublic(response.resolvedAddress);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new CollectorResponseError(`${this.name} returned HTTP ${response.status}.`);
    }
    if (new TextEncoder().encode(response.body).byteLength > this.options.maximumResponseBytes) {
      throw new CollectorResponseError(`${this.name} response exceeded the configured byte limit.`);
    }

    return this.parse(response.body, context).slice(0, this.options.maximumReports);
  }
}

export class RssAtomCollector extends SafeStructuredCollector {
  readonly id = "rss-atom";
  readonly name = "RSS and Atom feed adapter";
  readonly type = "rss" as const;
  protected readonly defaultEndpoint = "https://demo.invalid/feed.xml";
  protected readonly allowedHosts: readonly string[] = [];

  protected override endpoint(context: CollectorContext): string {
    return this.options.endpoint ?? context.source.url;
  }

  protected override dryRunTitle(): string {
    return "Structured bulletin feed connectivity exercise";
  }

  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    const fragments = [
      ...body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi),
      ...body.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi),
    ].map((match) => match[1]);

    return fragments.flatMap((fragment, index) => {
      const title = xmlTag(fragment, ["title"]);
      const url = xmlTag(fragment, ["link"]) ?? atomLink(fragment);
      if (!title || !url) return [];
      try {
        assertPublicHttpsUrl(url);
      } catch {
        return [];
      }
      const published = xmlTag(fragment, ["pubDate", "published", "updated"]);
      return [
        {
          externalId: xmlTag(fragment, ["guid", "id"]) ?? `${context.requestId}-${index}`,
          url,
          title,
          description: xmlTag(fragment, ["description", "summary"]),
          bodyText: xmlTag(fragment, ["content:encoded", "content"]),
          author: xmlTag(fragment, ["author", "dc:creator"]),
          language: "en",
          publishedAt: isoTimestamp(published, context.requestedAt),
          rawPayload: { format: "rss-or-atom", fragment },
        },
      ];
    });
  }
}

abstract class JsonApiCollector extends SafeStructuredCollector {
  protected parseJson(body: string): Record<string, unknown> {
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      throw new CollectorResponseError(`${this.name} returned invalid JSON.`);
    }
    const record = asRecord(value);
    if (!record) throw new CollectorResponseError(`${this.name} returned an unexpected JSON root.`);
    return record;
  }
}

export class UsgsEarthquakeCollector extends JsonApiCollector {
  readonly id = "usgs-earthquakes";
  readonly name = "USGS Earthquake GeoJSON adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
  protected readonly allowedHosts = ["earthquake.usgs.gov"];
  protected override dryRunTitle(): string {
    return "Synthetic seismic sensor event in the Pelagos Test Range";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    return asRecords(this.parseJson(body).features).flatMap((feature) => {
      const properties = asRecord(feature.properties) ?? {};
      const geometry = asRecord(feature.geometry);
      const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
      const title = stringValue(properties.title) ?? stringValue(properties.place);
      const url = stringValue(properties.url);
      if (!title || !url) return [];
      return [{
        externalId: stringValue(feature.id) ?? stringValue(properties.code),
        url,
        title,
        description: stringValue(properties.place),
        publishedAt: isoTimestamp(properties.time, context.requestedAt),
        longitude: numberValue(coordinates[0]),
        latitude: numberValue(coordinates[1]),
        rawPayload: feature,
      }];
    });
  }
}

function plainTextValue(value: unknown): string | undefined {
  const text = stringValue(value);
  return text ? decodeXml(text) : undefined;
}

export class GuardianOpenPlatformCollector extends JsonApiCollector {
  readonly id = "guardian-open-platform";
  readonly name = "The Guardian Open Platform adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint =
    "https://content.guardianapis.com/search?order-by=newest&page-size=25&show-fields=trailText,byline";
  protected readonly allowedHosts = ["content.guardianapis.com"];
  protected override dryRunTitle(): string {
    return "Synthetic international news report for the Meridian exercise";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    const response = asRecord(this.parseJson(body).response) ?? {};
    return asRecords(response.results).flatMap((article) => {
      const id = stringValue(article.id);
      const title = stringValue(article.webTitle);
      const url = stringValue(article.webUrl);
      if (!id || !title || !url) return [];
      const fields = asRecord(article.fields) ?? {};
      return [{
        externalId: id,
        url,
        title,
        description: plainTextValue(fields.trailText) ?? stringValue(article.sectionName),
        author: stringValue(fields.byline),
        language: "en",
        publishedAt: isoTimestamp(article.webPublicationDate, context.requestedAt),
        rawPayload: article,
      }];
    });
  }
}

export class XRecentSearchCollector extends JsonApiCollector {
  readonly id = "x-recent-search";
  readonly name = "X recent-search adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint =
    "https://api.x.com/2/tweets/search/recent?query=earthquake%20lang%3Aen%20-is%3Aretweet&max_results=25&tweet.fields=created_at,lang,author_id&expansions=author_id&user.fields=username";
  protected readonly allowedHosts = ["api.x.com"];
  protected override dryRunTitle(): string {
    return "Synthetic social signal requiring independent corroboration";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    const root = this.parseJson(body);
    const users = new Map(
      asRecords(asRecord(root.includes)?.users).flatMap((user) => {
        const id = stringValue(user.id);
        const username = stringValue(user.username);
        return id && username ? [[id, username] as const] : [];
      }),
    );
    return asRecords(root.data).flatMap((post) => {
      const id = stringValue(post.id);
      const postText = stringValue(post.text);
      if (!id || !postText) return [];
      const username = users.get(stringValue(post.author_id) ?? "");
      return [{
        externalId: id,
        url: username ? `https://x.com/${encodeURIComponent(username)}/status/${id}` : `https://x.com/i/web/status/${id}`,
        title: postText.length > 180 ? `${postText.slice(0, 177)}...` : postText,
        description: postText,
        author: username ? `@${username}` : undefined,
        language: stringValue(post.lang),
        publishedAt: isoTimestamp(post.created_at, context.requestedAt),
        rawPayload: post,
      }];
    });
  }
}

export class NasaEonetCollector extends JsonApiCollector {
  readonly id = "nasa-eonet";
  readonly name = "NASA EONET adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100";
  protected readonly allowedHosts = ["eonet.gsfc.nasa.gov"];
  protected override dryRunTitle(): string {
    return "Synthetic remote-sensing anomaly over the Borealis Test Basin";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    return asRecords(this.parseJson(body).events).flatMap((event) => {
      const geometries = asRecords(event.geometry);
      const latestGeometry = geometries.at(-1);
      const coordinates = Array.isArray(latestGeometry?.coordinates) ? latestGeometry.coordinates : [];
      const title = stringValue(event.title);
      const id = stringValue(event.id);
      if (!title || !id) return [];
      const sourceUrl = asRecords(event.sources).map((source) => stringValue(source.url)).find(Boolean);
      return [{
        externalId: id,
        url: sourceUrl ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(id)}`,
        title,
        description: stringValue(event.description),
        publishedAt: isoTimestamp(latestGeometry?.date, context.requestedAt),
        longitude: numberValue(coordinates[0]),
        latitude: numberValue(coordinates[1]),
        rawPayload: event,
      }];
    });
  }
}

export class GdacsCollector extends JsonApiCollector {
  readonly id = "gdacs";
  readonly name = "GDACS public API adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";
  protected readonly allowedHosts = ["gdacs.org"];
  protected override dryRunTitle(): string {
    return "Synthetic multi-hazard coordination notice for Arcadia Province";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    const root = this.parseJson(body);
    const features = asRecords(root.features ?? root.events);
    return features.flatMap((feature) => {
      const properties = asRecord(feature.properties) ?? feature;
      const geometry = asRecord(feature.geometry);
      const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
      const id = stringValue(feature.id) ?? stringValue(properties.eventid);
      const title = stringValue(properties.name) ?? stringValue(properties.eventname);
      if (!id || !title) return [];
      return [{
        externalId: id,
        url: stringValue(properties.url) ?? `https://www.gdacs.org/report.aspx?eventid=${encodeURIComponent(id)}`,
        title,
        description: stringValue(properties.description),
        publishedAt: isoTimestamp(properties.fromdate ?? properties.date, context.requestedAt),
        longitude: numberValue(coordinates[0]),
        latitude: numberValue(coordinates[1]),
        countryCode: stringValue(properties.iso3),
        rawPayload: feature,
      }];
    });
  }
}

export class ReliefWebCollector extends JsonApiCollector {
  readonly id = "reliefweb";
  readonly name = "ReliefWeb reports API adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint =
    "https://api.reliefweb.int/v1/reports?appname=argus-local&limit=100&sort[]=date:desc";
  protected readonly allowedHosts = ["api.reliefweb.int"];
  protected override dryRunTitle(): string {
    return "Synthetic humanitarian access update for the Meridian Islands";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    return asRecords(this.parseJson(body).data).flatMap((item) => {
      const fields = asRecord(item.fields) ?? {};
      const id = stringValue(item.id);
      const title = stringValue(fields.title);
      const url = stringValue(fields.url) ?? stringValue(fields.url_alias);
      if (!id || !title || !url) return [];
      return [{
        externalId: id,
        url,
        title,
        description: stringValue(fields.body),
        publishedAt: isoTimestamp(asRecord(fields.date)?.created ?? fields.date, context.requestedAt),
        rawPayload: item,
      }];
    });
  }
}

export class NwsAlertsCollector extends JsonApiCollector {
  readonly id = "nws-alerts";
  readonly name = "National Weather Service alerts adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint = "https://api.weather.gov/alerts/active";
  protected readonly allowedHosts = ["api.weather.gov"];
  protected override dryRunTitle(): string {
    return "Synthetic severe-weather exercise for Northwind County";
  }
  protected override requestHeaders(): Readonly<Record<string, string>> {
    return { ...super.requestHeaders(), accept: "application/geo+json" };
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    return asRecords(this.parseJson(body).features).flatMap((feature) => {
      const properties = asRecord(feature.properties) ?? {};
      const id = stringValue(properties.id) ?? stringValue(feature.id);
      const title = stringValue(properties.headline) ?? stringValue(properties.event);
      if (!id || !title) return [];
      return [{
        externalId: id,
        url: stringValue(properties.web) ?? stringValue(properties.uri) ?? id,
        title,
        description: stringValue(properties.description),
        bodyText: stringValue(properties.instruction),
        publishedAt: isoTimestamp(properties.sent ?? properties.effective, context.requestedAt),
        rawPayload: feature,
      }];
    });
  }
}

export class CisaKevCollector extends JsonApiCollector {
  readonly id = "cisa-kev";
  readonly name = "CISA Known Exploited Vulnerabilities adapter";
  readonly type = "dataset" as const;
  protected readonly defaultEndpoint =
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
  protected readonly allowedHosts = ["cisa.gov"];
  protected override dryRunTitle(): string {
    return "Synthetic vulnerability catalog update for CVE-2099-0001";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    return asRecords(this.parseJson(body).vulnerabilities).flatMap((item) => {
      const cve = stringValue(item.cveID);
      const name = stringValue(item.vulnerabilityName);
      if (!cve || !name) return [];
      return [{
        externalId: cve,
        url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(cve)}`,
        title: `${cve}: ${name}`,
        description: stringValue(item.shortDescription),
        publishedAt: isoTimestamp(item.dateAdded, context.requestedAt),
        rawPayload: item,
      }];
    });
  }
}

export class GdeltDiscoveryCollector extends JsonApiCollector {
  readonly id = "gdelt-discovery";
  readonly name = "GDELT DOC discovery adapter";
  readonly type = "api" as const;
  protected readonly defaultEndpoint =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=global&mode=artlist&maxrecords=100&format=json";
  protected readonly allowedHosts = ["api.gdeltproject.org"];
  protected override dryRunTitle(): string {
    return "Synthetic cross-source discovery item for the ARGUS exercise";
  }
  protected override parse(body: string, context: CollectorContext): CollectedReport[] {
    const root = this.parseJson(body);
    return asRecords(root.articles ?? root.data).flatMap((article, index) => {
      const title = stringValue(article.title);
      const url = stringValue(article.url);
      if (!title || !url) return [];
      return [{
        externalId: stringValue(article.id) ?? `${context.requestId}-${index}`,
        url,
        title,
        description: stringValue(article.seendate),
        author: stringValue(article.domain),
        language: stringValue(article.language),
        publishedAt: isoTimestamp(article.seendate, context.requestedAt),
        rawPayload: article,
      }];
    });
  }
}

export const createDefaultCollectors = (
  options: CollectorAdapterOptions = {},
): IntelligenceCollector[] => [
  new RssAtomCollector(options),
  new UsgsEarthquakeCollector(options),
  new GuardianOpenPlatformCollector(options),
  new XRecentSearchCollector(options),
  new NasaEonetCollector(options),
  new GdacsCollector(options),
  new ReliefWebCollector(options),
  new NwsAlertsCollector(options),
  new CisaKevCollector(options),
  new GdeltDiscoveryCollector(options),
];
