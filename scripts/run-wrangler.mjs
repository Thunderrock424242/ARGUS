import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/wrangler/bin/wrangler.js"),
    ...process.argv.slice(2),
    "--config",
    "wrangler.jsonc",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: resolve(".wrangler", "logs"),
    },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
