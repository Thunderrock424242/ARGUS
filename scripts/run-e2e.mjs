import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = process.env.ARGUS_E2E_PORT ?? "3100";
const healthUrl = `http://${host}:${port}/`;
const outputLimit = 16_384;
const testEnvironment = {
  ...process.env,
  ARGUS_E2E_PORT: port,
  VITE_ARGUS_DEMO_ENABLED: "true",
};
let serverOutput = "";

const server = spawn(
  process.execPath,
  [
    "./node_modules/vite/bin/vite.js",
    "--host",
    host,
    "--port",
    port,
    "--strictPort",
  ],
  {
    cwd: process.cwd(),
    env: testEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

for (const stream of [server.stdout, server.stderr]) {
  stream?.on("data", (chunk) => {
    serverOutput = `${serverOutput}${String(chunk)}`.slice(-outputLimit);
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`ARGUS test server exited early.\n${serverOutput}`);
    }
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The Vite development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`ARGUS test server did not become ready.\n${serverOutput}`);
}

async function stopServer() {
  if (server.exitCode !== null || !server.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await Promise.race([
      server.exitCode === null
        ? new Promise((resolve) => server.once("exit", resolve))
        : Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    server.stdout?.destroy();
    server.stderr?.destroy();
    server.unref();
    return;
  }
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

let exitCode = 1;
try {
  await waitForServer();
  const playwrightCli = fileURLToPath(
    new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
  );
  const tests = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: testEnvironment,
    stdio: "inherit",
    windowsHide: true,
  });
  exitCode = await new Promise((resolve) => tests.once("exit", (code) => resolve(code ?? 1)));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await stopServer();
}

process.exitCode = exitCode;
