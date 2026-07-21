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
| `GITHUB_OAUTH_CLIENT_ID` | For sign-in | unset | GitHub OAuth App client ID stored as a Worker secret |
| `GITHUB_OAUTH_CLIENT_SECRET` | For sign-in | unset | GitHub OAuth App client secret stored as a Worker secret |
| `AUTH_CALLBACK_URL` | For sign-in | Pages root | Exact registered GitHub OAuth callback |
| `AUTH_SESSION_TTL_SECONDS` | No | `28800` | ARGUS session lifetime, clamped to 15 minutes through 24 hours |
| `ARGUS_DEMO_ENABLED` | No | `true` | Worker-side fixture fallback, demonstration-record visibility, and seed-route switch |
| `COLLECTOR_PILOT_ENABLED` | No | `false` | Global kill switch for scheduled and authorized official-source collection |
| `COLLECTOR_USGS_ENABLED` | No | `true` | Enables the credential-free USGS pilot when the global switch is on |
| `COLLECTOR_GUARDIAN_ENABLED` | No | `true` | Requests Guardian collection; also requires `GUARDIAN_API_KEY` |
| `COLLECTOR_X_ENABLED` | No | `false` | Opts into pay-per-use X collection; also requires `X_BEARER_TOKEN` |
| `GUARDIAN_API_KEY` | For Guardian | unset | Guardian Open Platform key stored as a Worker secret |
| `X_BEARER_TOKEN` | For X | unset | X API app-only Bearer Token stored as a Worker secret |
| `RETENTION_DAYS` | No | `180` | Worker schedule retention window, clamped to 30-3650 days |
| `VITE_ARGUS_API_URL` | No | unset | Public URL of the separately hosted ARGUS brain; the browser fallback is used when unset |
| `VITE_ARGUS_DEMO_ENABLED` | No | `true` | Browser-side fixture fallback and demo-only screen switch; set it with the Pages repository variable `ARGUS_DEMO_ENABLED` |

`.env*` is ignored except `.env.example`. Values prefixed `VITE_` are browser-visible, so no ARGUS credential may use that prefix. Store Worker secrets through Cloudflare rather than committing them.

`ARGUS_ADMIN_TOKEN` enables the Worker's protected administrative handlers only when D1 is also configured. Generate it with a cryptographically secure local tool (for example, 32 random bytes encoded as hex), store it with `wrangler secret put ARGUS_ADMIN_TOKEN`, and send it only from a trusted administrative client in the `Authorization: Bearer` header.

For browser identity and role setup, follow [Identity and roles](identity-and-roles.md). For source activation, follow [Collectors and RSS sources](collectors.md). OAuth and collector secrets are Worker bindings and must never use the browser-visible `VITE_` prefix.

## Development modes

The default experience is deterministic and network-free while both demo flags are enabled:

- All displayed intelligence is fictional and set in the year 2042.
- Every record carries `dataClassification: "demonstration"` and a warning label.
- Collector adapters emit a synthetic report in dry-run mode.
- No API keys or third-party accounts are required.

To disable the demonstration completely, set `ARGUS_DEMO_ENABLED` to `"false"` in `wrangler.jsonc`, set the GitHub repository variable `ARGUS_DEMO_ENABLED` to `false`, deploy the Worker, and rebuild Pages. The Worker flag suppresses seed/fallback data and filters existing demonstration rows without deleting them; the Pages variable removes browser fallback and replaces demo-only screens with empty live-data states.

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
- **Remote Aether or sign-in is unavailable:** confirm `VITE_ARGUS_API_URL` in `.github/workflows/deploy-pages.yml` matches the deployed Worker URL and that the Pages origin is listed in `ALLOWED_ORIGINS`. The UI intentionally falls back to its bundled deterministic analysis where possible.
- **D1 binding unavailable:** with demo enabled, the Worker falls back to immutable demonstration fixtures; with demo disabled, reads are empty. Durable writes return `durable_store_unavailable` in both cases.
- **Collector run shows no network access:** correct; administrative API collector runs are always dry-run in this MVP.
