# Identity and roles

ARGUS uses GitHub OAuth with PKCE for human identity and D1 for short-lived ARGUS sessions and role assignments. GitHub Pages remains a static public site; all authorization decisions happen in the Cloudflare Worker.

## Security boundary

- The browser creates the PKCE verifier and validates OAuth `state`.
- The Worker exchanges the one-time GitHub code with the client secret.
- ARGUS requests no GitHub scopes, reads only the authenticated public profile, and rejects a grant that carries repository scopes.
- The temporary GitHub token is never stored or returned and is revoked after identity lookup.
- The Worker returns one opaque ARGUS session credential. The browser keeps it in tab-scoped `sessionStorage`; D1 stores only its SHA-256 hash.
- Sessions expire after eight hours by default and can be revoked by signing out.
- The existing `ARGUS_ADMIN_TOKEN` remains an emergency/bootstrap credential for trusted command-line use. It is never placed in the Pages bundle.
- Protected requests use D1-backed fixed-window counters rather than process-local Worker state.

GitHub documents the [OAuth web application and PKCE flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps). Cloudflare D1 provides the durable session, role, audit, and rate-limit tables.

## Roles

Every OAuth identity receives `viewer`. Additional roles add explicit permissions:

| Role | Permissions |
| --- | --- |
| `viewer` | Read its own identity profile |
| `analyst` | Act on alerts, save personal monitoring layouts, and submit evidence to ingestion |
| `reviewer` | Analyst permissions plus event, relationship, and ingestion review |
| `source-manager` | Analyst permissions plus controlled dry-run collector execution and failed-ingestion retry |
| `administrator` | Every permission, including role management, retention, and demonstration seeding |

Roles are enforced in the Worker. Hiding or displaying a browser control is never treated as authorization. The last administrator role cannot be removed.

## One-time deployment setup

Run these commands in PowerShell from `C:\Users\mason\IdeaProjects\ARGUS`.

### 1. Create the GitHub OAuth App

1. Open GitHub **Settings > Developer settings > OAuth Apps > New OAuth App**.
2. Use `ARGUS Identity` as the application name.
3. Set **Homepage URL** to `https://thunderrock424242.github.io/ARGUS/`.
4. Set **Authorization callback URL** to exactly `https://thunderrock424242.github.io/ARGUS/`.
5. Register the app and generate a client secret. Do not enable Device Flow and do not add scopes.

### 2. Store both OAuth values as Worker secrets

```powershell
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
```

Paste one value when each command prompts. The client ID is public by protocol, but using the same secret-management path avoids dashboard/config drift.

### 3. Baseline the existing database, then apply the identity migration

ARGUS migrations `0000` through `0003` were originally applied with `wrangler d1 execute`, before Wrangler migration tracking was enabled. Record those already-applied files once, list what remains, and then apply the pending identity migrations:

```powershell
npx wrangler d1 execute argus-intelligence --remote --file=scripts/baseline-existing-d1-migrations.sql
npx wrangler d1 migrations list argus-intelligence --remote
npx wrangler d1 migrations apply argus-intelligence --remote
npm run brain:check
npm run brain:deploy
```

On a database that was only baselined through `0003`, the list should show `0004_groovy_revanche.sql`, `0005_abnormal_giant_man.sql`, and `0006_brown_exiles.sql` as pending. On the current public database, only `0006_brown_exiles.sql` should remain after the identity migrations. If an older unexpected migration appears, stop instead of confirming and inspect `d1_migrations` first. Migration `0004` creates identity tables, `0005` keeps mutable GitHub logins non-authoritative, and `0006` creates the protected ingestion and attempt tables. Apply every pending migration before deploying Worker code that uses it.

### 4. Sign in and grant the first administrator

Open the Pages site, select **Sign in**, and complete GitHub authorization. A new identity starts as `viewer`.

In PowerShell, use the existing admin token to list identities:

```powershell
$argusWorkerUrl = "https://argus-brain.thunderrock-labs.workers.dev"
$argusAdminToken = Read-Host "ARGUS admin token"

$users = Invoke-RestMethod `
  -Method Get `
  -Uri "$argusWorkerUrl/api/admin/users" `
  -Headers @{ Authorization = "Bearer $argusAdminToken" }

$users.data.users | Format-Table id, login, displayName, roles
```

Copy your stable `user:github:...` ID and grant administrator:

```powershell
$argusUserId = "user:github:REPLACE_WITH_YOUR_NUMERIC_GITHUB_ID"
$argusUserIdEncoded = [uri]::EscapeDataString($argusUserId)

Invoke-RestMethod `
  -Method Put `
  -Uri "$argusWorkerUrl/api/admin/users/$argusUserIdEncoded/roles" `
  -Headers @{ Authorization = "Bearer $argusAdminToken" } `
  -ContentType "application/json" `
  -Body (@{
    roles = @("administrator")
    reason = "Initial ARGUS administrator bootstrap"
  } | ConvertTo-Json)
```

Refresh the site. The profile menu should show `viewer` and `administrator`; event and relationship review actions will now create D1 writes and stable-ID audit entries.

## Recovery

If OAuth is misconfigured, the public demonstration remains readable. Correct the OAuth App callback, replace the Worker secrets, and redeploy. If all human administrators lose access, use `ARGUS_ADMIN_TOKEN` from a trusted PowerShell session to restore an administrator role. Rotate that token if it is ever exposed.
