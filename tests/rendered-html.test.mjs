import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("exports the ARGUS global operations view for GitHub Pages", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Global Operations \| ARGUS<\/title>/i);
  assert.match(html, /ARGUS/);
  assert.match(html, /Observe\. Correlate\. Understand\./);
  assert.match(html, /(?:href|src)="\/ARGUS\//);
  assert.doesNotMatch(html, /\/_next\//);
  assert.doesNotMatch(html, /\/ARGUS\/ARGUS\/(?:og|argus-icon)\.png/);
  await access(new URL("../dist/.nojekyll", import.meta.url));
  await access(
    new URL(
      "../dist/events/demo-helios-municipal-ransomware/index.html",
      import.meta.url,
    ),
  );
  await access(new URL("../dist/relationships/index.html", import.meta.url));
  await access(new URL("../dist/timeline/index.html", import.meta.url));

  const assetsDirectory = new URL("../dist/assets/", import.meta.url);
  const assetFiles = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));
  const bundles = await Promise.all(
    assetFiles.map((file) => readFile(new URL(file, assetsDirectory), "utf8")),
  );
  const javascript = bundles.join("\n");
  assert.match(javascript, /Global Operations View/i);
  assert.match(javascript, /Hypothesis[^A-Za-z]+analyst review required/i);
  assert.match(javascript, /Demonstration data[^<]*not real-world intelligence/i);
  assert.doesNotMatch(javascript, /Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the ARGUS shell and analyst routes in production source", async () => {
  const [page, entry, css, operationsMap, operationsView, alertCenter, worker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../site/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/dashboard/operations-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/operations/global-operations-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/operations/alert-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /GlobalOperationsView/);
  assert.match(entry, /BrowserRouter/);
  assert.match(entry, /AppShell/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(operationsMap, /projection:\s*\{\s*type:\s*"globe"/);
  assert.match(operationsMap, /Switch to.*flat map.*3D globe/s);
  assert.match(operationsView, /api\/operations\/snapshot/);
  assert.match(alertCenter, /new Notification/);
  assert.match(worker, /D1IntelligenceDataProvider/);

  for (const route of [
    "events",
    "dashboard",
    "relationships",
    "consequences",
    "conflicts",
    "timeline",
    "alerts",
    "live-feeds",
    "wall",
    "map",
    "review",
    "sources",
    "watchlists",
    "briefs",
    "aether",
    "system",
    "settings",
  ]) {
    await access(new URL(`../app/${route}/page.tsx`, import.meta.url));
  }
});
