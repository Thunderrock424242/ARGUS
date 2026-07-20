/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB?: D1Database;
  ALLOWED_ORIGINS?: string;
  ARGUS_ADMIN_TOKEN?: string;
  RETENTION_DAYS?: string;
}

declare module "cloudflare:workers" {
  export const env: Env;
}
