/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

declare module "cloudflare:workers" {
  export const env: Env;
}
