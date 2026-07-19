export type PublicUrlFailureCode =
  | "invalid-url"
  | "unsupported-protocol"
  | "embedded-credentials"
  | "forbidden-port"
  | "forbidden-host"
  | "unresolved-host"
  | "forbidden-address"
  | "host-not-allowlisted";

export class PublicUrlValidationError extends Error {
  override readonly name = "PublicUrlValidationError";

  constructor(
    readonly code: PublicUrlFailureCode,
    message: string,
  ) {
    super(message);
  }
}

export interface PublicUrlPolicy {
  requireHttps?: boolean;
  allowNonStandardPorts?: boolean;
  allowedHosts?: readonly string[];
  allowSubdomainsOfAllowedHosts?: boolean;
  maximumLength?: number;
}

export type PublicHostResolver = (hostname: string) => Promise<readonly string[]>;

function normalizedHostname(value: string): string {
  return value.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLocaleLowerCase("en-US");
}

function ipv4Octets(value: string): [number, number, number, number] | null {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return null;
  return octets as [number, number, number, number];
}

function ipv6Bytes(value: string): Uint8Array | null {
  let input = normalizedHostname(value);
  if (!input.includes(":") || input.includes("%")) return null;

  const embeddedIpv4 = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (embeddedIpv4) {
    const octets = ipv4Octets(embeddedIpv4);
    if (!octets) return null;
    const replacement = `${((octets[0] << 8) | octets[1]).toString(16)}:${(
      (octets[2] << 8) |
      octets[3]
    ).toString(16)}`;
    input = `${input.slice(0, -embeddedIpv4.length)}${replacement}`;
  }

  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups = [...left, ...right];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;

  if (halves.length === 1 && groups.length !== 8) return null;
  const omitted = halves.length === 2 ? 8 - groups.length : 0;
  if (halves.length === 2 && omitted < 1) return null;
  const expanded = [...left, ...Array.from({ length: omitted }, () => "0"), ...right];
  if (expanded.length !== 8) return null;

  const bytes = new Uint8Array(16);
  expanded.forEach((group, index) => {
    const numeric = Number.parseInt(group, 16);
    bytes[index * 2] = numeric >> 8;
    bytes[index * 2 + 1] = numeric & 0xff;
  });
  return bytes;
}

function isForbiddenIpv4(octets: readonly number[]): boolean {
  const [first, second, third] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function bytesStartWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function isForbiddenIpv6(bytes: Uint8Array): boolean {
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (allZero || loopback) return true;
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link local
  if (bytes[0] === 0xff) return true; // multicast
  if (bytesStartWith(bytes, [0x20, 0x01, 0x0d, 0xb8])) return true; // documentation

  const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const ipv4Compatible = bytes.slice(0, 12).every((byte) => byte === 0);
  const nat64 = bytesStartWith(bytes, [0x00, 0x64, 0xff, 0x9b]) && bytes.slice(4, 12).every((byte) => byte === 0);
  if (ipv4Mapped || ipv4Compatible || nat64) {
    return isForbiddenIpv4([...bytes.slice(12)]);
  }
  return false;
}

export function isForbiddenNetworkAddress(value: string): boolean {
  const hostname = normalizedHostname(value);
  const ipv4 = ipv4Octets(hostname);
  if (ipv4) return isForbiddenIpv4(ipv4);
  const ipv6 = ipv6Bytes(hostname);
  return ipv6 ? isForbiddenIpv6(ipv6) : false;
}

export function isIpAddress(value: string): boolean {
  const hostname = normalizedHostname(value);
  return ipv4Octets(hostname) !== null || ipv6Bytes(hostname) !== null;
}

function assertAllowedHost(hostname: string, policy: PublicUrlPolicy): void {
  const forbiddenSuffixes = [
    ".localhost",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".home.arpa",
    ".corp",
  ];
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "localhost.localdomain" ||
    forbiddenSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    (!hostname.includes(".") && !isIpAddress(hostname)) ||
    isForbiddenNetworkAddress(hostname)
  ) {
    throw new PublicUrlValidationError(
      "forbidden-host",
      "The URL host is local, private, link-local, or otherwise unavailable for collection.",
    );
  }

  if (policy.allowedHosts?.length) {
    const allowed = policy.allowedHosts.map(normalizedHostname).some((candidate) =>
      policy.allowSubdomainsOfAllowedHosts
        ? hostname === candidate || hostname.endsWith(`.${candidate}`)
        : hostname === candidate,
    );
    if (!allowed) {
      throw new PublicUrlValidationError(
        "host-not-allowlisted",
        "The URL host is not in the collector allowlist.",
      );
    }
  }
}

/** Performs syntax and literal-address checks without making a network request. */
export function assertPublicHttpUrl(value: string, policy: PublicUrlPolicy = {}): URL {
  const maximumLength = policy.maximumLength ?? 2_048;
  if (!value || value.length > maximumLength || value !== value.trim()) {
    throw new PublicUrlValidationError("invalid-url", "The source URL is invalid or too long.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PublicUrlValidationError("invalid-url", "The source URL must be absolute.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicUrlValidationError(
      "unsupported-protocol",
      "Only HTTP and HTTPS source URLs are accepted.",
    );
  }
  if (policy.requireHttps && url.protocol !== "https:") {
    throw new PublicUrlValidationError("unsupported-protocol", "This collector requires HTTPS.");
  }
  if (url.username || url.password) {
    throw new PublicUrlValidationError(
      "embedded-credentials",
      "Credentials must never be embedded in source URLs.",
    );
  }
  if (!policy.allowNonStandardPorts) {
    const expectedPort = url.protocol === "https:" ? "443" : "80";
    if (url.port && url.port !== expectedPort) {
      throw new PublicUrlValidationError(
        "forbidden-port",
        "Source URLs may only use the standard HTTP or HTTPS port.",
      );
    }
  }

  assertAllowedHost(normalizedHostname(url.hostname), policy);
  return url;
}

/**
 * Resolves a hostname and rejects the URL unless every answer is public.
 * The transport must still pin/re-check the connected address and reject redirects.
 */
export async function assertPublicResolvedUrl(
  value: string,
  resolver: PublicHostResolver,
  policy: PublicUrlPolicy = {},
): Promise<{ url: URL; addresses: readonly string[] }> {
  const url = assertPublicHttpUrl(value, policy);
  const hostname = normalizedHostname(url.hostname);
  if (isIpAddress(hostname)) return { url, addresses: [hostname] };

  let addresses: readonly string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new PublicUrlValidationError("unresolved-host", "The source host could not be resolved.");
  }
  if (!addresses.length) {
    throw new PublicUrlValidationError("unresolved-host", "The source host returned no addresses.");
  }
  if (addresses.some((address) => !isIpAddress(address) || isForbiddenNetworkAddress(address))) {
    throw new PublicUrlValidationError(
      "forbidden-address",
      "The source host resolves to a local, private, link-local, or invalid address.",
    );
  }
  return { url, addresses };
}
