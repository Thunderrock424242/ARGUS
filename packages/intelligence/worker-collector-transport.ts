import {
  CollectorConfigurationError,
  CollectorResponseError,
  assertPublicHttpsUrl,
  type CollectorTransport,
  type CollectorTransportRequest,
  type CollectorTransportResponse,
} from "./collectors";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface OfficialEndpointRule {
  host: string;
  pathPrefix: string;
  contentTypes: readonly string[];
  credential: "none" | "guardian" | "x";
}

const OFFICIAL_ENDPOINT_RULES: readonly OfficialEndpointRule[] = [
  {
    host: "earthquake.usgs.gov",
    pathPrefix: "/earthquakes/feed/v1.0/summary/",
    contentTypes: ["application/geo+json", "application/json"],
    credential: "none",
  },
  {
    host: "content.guardianapis.com",
    pathPrefix: "/search",
    contentTypes: ["application/json"],
    credential: "guardian",
  },
  {
    host: "api.x.com",
    pathPrefix: "/2/tweets/search/recent",
    contentTypes: ["application/json"],
    credential: "x",
  },
];

function approvedRule(url: URL): OfficialEndpointRule {
  const rule = OFFICIAL_ENDPOINT_RULES.find(
    (candidate) => url.hostname.toLocaleLowerCase("en-US") === candidate.host && url.pathname.startsWith(candidate.pathPrefix),
  );
  if (!rule) {
    throw new CollectorConfigurationError("The collector destination is not a fixed official pilot endpoint.");
  }
  return rule;
}

async function boundedText(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new CollectorResponseError("Collector response exceeded the configured byte limit.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("response-too-large");
        throw new CollectorResponseError("Collector response exceeded the configured byte limit.");
      }
      output += decoder.decode(part.value, { stream: true });
    }
    return output + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function safeResponseHeaders(headers: Headers): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of ["content-type", "content-length", "etag", "last-modified", "x-rate-limit-remaining"]) {
    const value = headers.get(name);
    if (value) result[name] = value;
  }
  return result;
}

export class WorkerOfficialCollectorTransport implements CollectorTransport {
  constructor(
    private readonly options: {
      fetcher?: Fetcher;
      guardianApiKey?: string;
      xBearerToken?: string;
    } = {},
  ) {}

  async request(request: CollectorTransportRequest): Promise<CollectorTransportResponse> {
    if (request.redirectPolicy !== "error") {
      throw new CollectorConfigurationError("Official collector redirects must be disabled.");
    }
    const url = assertPublicHttpsUrl(request.url);
    const rule = approvedRule(url);
    const headers = new Headers(request.headers);
    headers.delete("authorization");

    if (rule.credential === "guardian") {
      if (!this.options.guardianApiKey) {
        throw new CollectorConfigurationError("The Guardian API key is not configured.");
      }
      url.searchParams.set("api-key", this.options.guardianApiKey);
    } else if (rule.credential === "x") {
      if (!this.options.xBearerToken) {
        throw new CollectorConfigurationError("The X API bearer token is not configured.");
      }
      headers.set("authorization", `Bearer ${this.options.xBearerToken}`);
    }

    const timeoutSignal = AbortSignal.timeout(request.timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeoutSignal])
      : timeoutSignal;
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(url, {
      method: "GET",
      headers,
      redirect: "manual",
      signal,
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel("redirect-rejected");
      throw new CollectorResponseError("Official collector redirects are not permitted.");
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
    if (!contentType || !rule.contentTypes.includes(contentType)) {
      await response.body?.cancel("content-type-rejected");
      throw new CollectorResponseError("The official collector returned an unsupported content type.");
    }

    return {
      status: response.status,
      finalUrl: request.url,
      headers: safeResponseHeaders(response.headers),
      body: await boundedText(response, request.maximumResponseBytes),
      securityPolicy: "fixed-official-endpoint",
    };
  }
}
