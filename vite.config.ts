import react from "@vitejs/plugin-react";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { demoBriefs, demoEvents } from "./packages/shared/demo-data";

const staticRoutes = [
  "dashboard",
  "map",
  "orbit",
  "events",
  "relationships",
  "consequences",
  "conflicts",
  "timeline",
  "alerts",
  "live-feeds",
  "wall",
  "briefs",
  "watchlists",
  "sources",
  "review",
  "aether",
  "system",
  "settings",
  ...demoEvents.map((event) => `events/${event.slug}`),
  ...demoBriefs.map((brief) => `briefs/${brief.slug}`),
];

function githubPagesFallbacks(): Plugin {
  return {
    name: "argus-github-pages-fallbacks",
    apply: "build",
    async closeBundle() {
      const outputDirectory = resolve("dist");
      const indexPath = resolve(outputDirectory, "index.html");
      const index = await readFile(indexPath, "utf8");
      for (const route of staticRoutes) {
        const routeDirectory = resolve(outputDirectory, route);
        await mkdir(routeDirectory, { recursive: true });
        await writeFile(resolve(routeDirectory, "index.html"), index);
      }
      await cp(indexPath, resolve(outputDirectory, "404.html"));
      await writeFile(resolve(outputDirectory, ".nojekyll"), "");
    },
  };
}

function githubPagesBase(): string {
  const repository = process.env.GITHUB_REPOSITORY ?? "Thunderrock424242/ARGUS";
  const [owner = "Thunderrock424242", repositoryName = "ARGUS"] =
    repository.split("/");
  const defaultBase =
    repositoryName.toLowerCase() === `${owner.toLowerCase()}.github.io`
      ? "/"
      : `/${repositoryName}/`;
  const configured = process.env.ARGUS_PAGES_BASE_PATH;
  if (!configured) return defaultBase;
  return `/${configured.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : githubPagesBase(),
  plugins: [react(), githubPagesFallbacks()],
  resolve: {
    alias: { "@": resolve(".") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // MapLibre is intentionally isolated behind the lazy-loaded map routes.
    chunkSizeWarningLimit: 1_100,
  },
}));
