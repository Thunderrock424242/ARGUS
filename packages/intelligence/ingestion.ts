import type { EventCategory } from "@/packages/shared/types";
import { normalizeText, normalizeUrl, normalizeWhitespace } from "./text";

export interface IngestionIntake {
  sourceId: string;
  externalId?: string;
  idempotencyKey?: string;
  url: string;
  title: string;
  description?: string;
  bodyText?: string;
  author?: string;
  language: string;
  publishedAt: string;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  category?: EventCategory;
  attribution?: string;
  provenanceNotes?: string;
}

export interface NormalizedIngestionIntake extends IngestionIntake {
  normalizedUrl: string;
}

export function normalizeIngestionIntake(input: IngestionIntake): NormalizedIngestionIntake {
  return {
    ...input,
    sourceId: input.sourceId.trim(),
    externalId: input.externalId ? normalizeWhitespace(input.externalId) : undefined,
    idempotencyKey: input.idempotencyKey?.trim(),
    url: input.url.trim(),
    normalizedUrl: normalizeUrl(input.url),
    title: normalizeWhitespace(input.title),
    description: input.description ? normalizeWhitespace(input.description) : undefined,
    bodyText: input.bodyText ? normalizeWhitespace(input.bodyText) : undefined,
    author: input.author ? normalizeWhitespace(input.author) : undefined,
    language: input.language.toLocaleLowerCase("en-US"),
    publishedAt: new Date(input.publishedAt).toISOString(),
    countryCode: input.countryCode?.toLocaleUpperCase("en-US"),
    attribution: input.attribution ? normalizeWhitespace(input.attribution) : undefined,
    provenanceNotes: input.provenanceNotes ? normalizeWhitespace(input.provenanceNotes) : undefined,
  };
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function ingestionContentHash(input: NormalizedIngestionIntake): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      sourceId: normalizeText(input.sourceId),
      externalId: input.externalId ? normalizeText(input.externalId) : null,
      normalizedUrl: input.normalizedUrl,
      title: normalizeText(input.title),
      description: normalizeText(input.description ?? ""),
      bodyText: normalizeText(input.bodyText ?? ""),
      publishedAt: input.publishedAt,
    }),
  );
}

export async function ingestionIdempotencyKey(
  input: NormalizedIngestionIntake,
  contentHash: string,
): Promise<string> {
  const material = input.idempotencyKey
    ? `client:${input.sourceId}:${input.idempotencyKey}`
    : input.externalId
      ? `external:${input.sourceId}:${normalizeText(input.externalId)}`
      : `content:${input.sourceId}:${contentHash}`;
  return sha256Hex(material);
}
