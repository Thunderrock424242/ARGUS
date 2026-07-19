import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the ARGUS command center", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Command Center \| ARGUS<\/title>/i);
  assert.match(html, /ARGUS/);
  assert.match(html, /Global operating picture/i);
  assert.match(html, /Demonstration data[^<]*not real-world intelligence/i);
  assert.match(html, /Observe\. Correlate\. Understand\./);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the ARGUS shell and analyst routes in production source", async () => {
  const [page, layout, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /CommandCenter/);
  assert.match(layout, /AppShell/);
  assert.match(layout, /Analysis and Reporting of Global Unfolding Situations/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);

  for (const route of [
    "events",
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
