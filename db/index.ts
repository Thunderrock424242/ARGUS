import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const argusEnv = env as unknown as { DB?: D1Database };

export function getDb() {
  if (!argusEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Add the real D1 binding to the standalone Worker's wrangler configuration before using the database."
    );
  }

  return drizzle(argusEnv.DB, { schema });
}
