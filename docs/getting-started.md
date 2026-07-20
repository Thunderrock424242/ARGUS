# Local setup and environment

## Prerequisites

- Node.js 22.13 or newer
- npm
- A modern browser with WebGL for the global map

Install and start the ordinary development server:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Use `npm run brain:dev` in a second terminal when testing the standalone Cloudflare Worker API. The Vite frontend development server defaults to port 5173 and Wrangler reports the Worker's local port when it starts.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ARGUS_ADMIN_TOKEN` | No | unset | Enables protected administrative routes only when configured |
| `ARGUS_COLLECTOR_MODE` | No | `dry-run` | Operational intent; admin web requests remain dry-run regardless |
| `RETENTION_DAYS` | No | `180` | Worker schedule retention window, clamped to 30-3650 days |
| `VITE_ARGUS_API_URL` | No | unset | Public URL of the separately hosted ARGUS brain; the browser fallback is used when unset |

`.env*` is ignored except `.env.example`. Values prefixed `VITE_` are browser-visible, so no ARGUS credential may use that prefix. Store Worker secrets through Cloudflare rather than committing them.

`ARGUS_ADMIN_TOKEN` enables the Worker's protected administrative handlers only when D1 is also configured. Generate it with a cryptographically secure local tool (for example, 32 random bytes encoded as hex), store it with `wrangler secret put ARGUS_ADMIN_TOKEN`, and send it only from a trusted administrative client in the `Authorization: Bearer` header.

## Development modes

The default experience is deterministic and network-free:

- All displayed intelligence is fictional and set in the year 2042.
- Every record carries `dataClassification: "demonstration"` and a warning label.
- Collector adapters emit a synthetic report in dry-run mode.
- No API keys or third-party accounts are required.

## Validation commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run brain:check
```

`npm run test:e2e` runs Playwright suites when browser tests are present. `npm run db:generate` creates a Drizzle migration after an intentional schema change. Inspect generated SQL before applying it anywhere.

## Troubleshooting

- **Admin route is unavailable on Pages:** correct; Pages is static. Worker admin routes also stay disabled until both the D1 binding and admin secret exist.
- **Map or globe is blank:** verify WebGL support and that the browser can reach the configured public tile service. Switch to flat-map mode if the device struggles with globe projection. The rest of ARGUS remains usable without map rendering.
- **Remote Aether is unavailable:** confirm the GitHub repository variable `ARGUS_API_URL` matches the deployed Worker URL and that the Pages origin is listed in `ALLOWED_ORIGINS`. The UI intentionally falls back to its bundled deterministic analysis.
- **D1 binding unavailable:** the Worker intentionally falls back to immutable demonstration fixtures, and durable writes return `durable_store_unavailable`.
- **Collector run shows no network access:** correct; administrative API collector runs are always dry-run in this MVP.
