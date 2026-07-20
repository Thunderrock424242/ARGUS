const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bearerCredential(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  return authorization.match(/^Bearer ([^\s,]{1,4096})$/i)?.[1] ?? null;
}

export function createSessionCredential(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `argus_session_${bytesToBase64Url(bytes)}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function isSessionCredential(value: string): boolean {
  return /^argus_session_[A-Za-z0-9_-]{43}$/.test(value);
}
