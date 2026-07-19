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

Use `npm run dev:sites` when testing the Cloudflare/vinext runtime and local D1 binding simulation. Do not run both development commands on the same port.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ARGUS_ADMIN_TOKEN` | No | unset | Enables protected administrative routes only when configured |
| `ARGUS_DATA_PROVIDER` | No | `mock` | Documents the selected provider; only the mock provider is wired in this MVP |
| `ARGUS_COLLECTOR_MODE` | No | `dry-run` | Operational intent; admin web requests remain dry-run regardless |

`.env*` is ignored except `.env.example`. Values prefixed `NEXT_PUBLIC_` are browser-visible, so no ARGUS credential may use that prefix. In hosted environments, configure secrets through the Sites runtime rather than committing them.

Generate an administrator token with a cryptographically secure local tool (for example, 32 random bytes encoded as hex), store it only in `.env.local` or the hosting secret manager, and send it in the `Authorization: Bearer` header. Restart the local server after changing environment variables.

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
```

`npm run test:e2e` runs Playwright suites when browser tests are present. `npm run db:generate` creates a Drizzle migration after an intentional schema change. Inspect generated SQL before applying it anywhere.

## Troubleshooting

- **Admin route returns 503:** this is expected until `ARGUS_ADMIN_TOKEN` is configured server-side.
- **Admin route returns 401:** use the exact bearer value; do not send the token as a query parameter.
- **Map is blank:** verify WebGL support and that the browser can reach the configured public tile service. The rest of ARGUS remains usable without map rendering.
- **D1 binding unavailable:** use the mock provider locally or run through the Sites/Vite path with the `DB` binding. Do not silently fall back during a production write.
- **Collector run shows no network access:** correct; administrative API collector runs are always dry-run in this MVP.
