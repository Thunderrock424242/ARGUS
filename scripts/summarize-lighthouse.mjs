import { appendFile, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const resultsDirectory = resolve(".lighthouseci");
const reportFiles = (await readdir(resultsDirectory))
  .filter((file) => file.startsWith("lhr-") && file.endsWith(".json"))
  .sort();

if (reportFiles.length === 0) {
  throw new Error(`No Lighthouse result files found in ${resultsDirectory}.`);
}

const reports = await Promise.all(
  reportFiles.map(async (file) =>
    JSON.parse(await readFile(resolve(resultsDirectory, file), "utf8")),
  ),
);

const groups = Map.groupBy(reports, (report) => report.finalDisplayedUrl);

function median(values) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function score(reportsForUrl, category) {
  const value = median(
    reportsForUrl.map((report) => report.categories[category]?.score * 100),
  );
  return value === undefined ? "n/a" : Math.round(value).toString();
}

function metric(reportsForUrl, audit, digits = 0) {
  const value = median(
    reportsForUrl.map((report) => report.audits[audit]?.numericValue),
  );
  return value === undefined ? "n/a" : value.toFixed(digits);
}

const lines = [
  "## Lighthouse median results",
  "",
  `Collected ${reports.length} reports across ${groups.size} URLs. Scores are 0-100; timing metrics are milliseconds.`,
  "",
  "| URL | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed index |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
];

for (const [url, reportsForUrl] of groups) {
  const parsedUrl = new URL(url);
  lines.push(
    `| \`${parsedUrl.pathname}\` | ${score(reportsForUrl, "performance")} | ${score(reportsForUrl, "accessibility")} | ${score(reportsForUrl, "best-practices")} | ${score(reportsForUrl, "seo")} | ${metric(reportsForUrl, "first-contentful-paint")} | ${metric(reportsForUrl, "largest-contentful-paint")} | ${metric(reportsForUrl, "total-blocking-time")} | ${metric(reportsForUrl, "cumulative-layout-shift", 3)} | ${metric(reportsForUrl, "speed-index")} |`,
  );
}

const summary = `${lines.join("\n")}\n`;
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}
