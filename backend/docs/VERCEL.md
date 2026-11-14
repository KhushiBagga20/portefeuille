# Deploying portefeuille on Vercel

The root vercel.json deploys the existing Astro frontend. Import
https://github.com/KhushiBagga20/portefeuille with root directory `.` and production branch `main`.
Leave PORTFOLIO_API_URL empty for the first deployment so the existing projects stay visible.
The studio page is included, but login requires the API to be configured.

## Full application

Vercel currently supports FastAPI services and long-running Daemons (both the multi-service model and
Daemons are beta). The backend worker must be a separate Daemon; do not start its infinite loop in a
request handler. PostgreSQL must be a managed external database, not a file inside a function/container.

The proposed full setup uses one public domain with routes `/api/*`, `/auth/*`, `/webhooks/*`, `/health`,
`/docs` and `/openapi.json` directed to the FastAPI service. All other routes go to Astro. This keeps
owner cookies on the same site. The API service root is backend/ and entrypoint is app.main:app.
The worker root is backend/ and its command is `python -m app.worker`, using a restricted worker login.

Before enabling this setup:

1. Connect the Vercel account/project and confirm the available Services/Daemons beta features and quotas.
   A continuously running worker consumes provisioned-memory quota even while idle. No worker has been
   provisioned or spending commitment made by this repository configuration.
2. Create/connect managed PostgreSQL; use a pooled connection string with TLS when required by the host.
3. Apply migrations with a privileged migration login, import the six projects as drafts, and set up the
   restricted worker login using scripts/worker-role.sql.
4. Configure the API's ENVIRONMENT=production, DATABASE_URL, OWNER_GITHUB_ID, SESSION_SECRET,
   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_WEBHOOK_SECRET, BACKEND_ORIGIN and FRONTEND_ORIGIN.
   Set both origins to the chosen public origin, without a trailing slash.
5. Configure the worker's database credentials and optional OPENAI_API_KEY and OPENAI_MODEL separately.
   Never expose secrets through PUBLIC_ environment variables or commit them to GitHub.
6. Use the public domain's /auth/github/callback for the GitHub OAuth application, and /webhooks/github
   for selected repository activity. Keep preview deployments separate from production data/credentials.
7. Sign in to /studio/, review the imported content, and publish the projects you want visible.
8. Set PORTFOLIO_API_URL to the stable public API origin and rebuild. Build-time fetching must reach an
   already-running backend; avoid making the initial frontend build depend on an undeployed service.
9. Create a Vercel Deploy Hook for main. The next backend integration should enqueue that hook after
   successful publication and record deployment status. Until then, redeploy manually after approval.

PUBLIC_API_ORIGIN stays empty for same-origin routing. If the API is on another domain, same-site
custom subdomains or a proxy are needed for the existing SameSite=Lax cookie configuration. Do not
weaken session cookie security merely to connect unrelated hosting subdomains.

Do not run migrations on each API request or on every preview build. Do not enable a worker against an
unmigrated database. GitHub CI verifies code and migrations; it does not deploy or supply credentials.

## Official references checked during setup

- https://vercel.com/docs/frameworks/frontend/astro
- https://vercel.com/docs/frameworks/backend/fastapi
- https://vercel.com/docs/services
- https://vercel.com/docs/daemons

Deployment status: configuration and instructions prepared; no Vercel account, database, OAuth app,
webhook, deploy hook or paid resource has been created or configured.

## Prepared configuration (not activated)

`deployment/vercel.full.json` is the full application configuration to copy to the REPOSITORY ROOT as
`vercel.json` after account/database/OAuth setup. Its paths are relative to the repository root, not to
this file's directory. It routes the public site, studio login, webhooks and API under the same domain.
It starts with zero worker instances; choose the database region and review the daemon quota before
changing the instance count to one. The existing root vercel.json remains frontend-only until then.

For this portfolio, the verified public settings are:

```text
FRONTEND_ORIGIN=https://portefeuille-psi.vercel.app
BACKEND_ORIGIN=https://portefeuille-psi.vercel.app
OWNER_GITHUB_ID=245793203
```

The GitHub OAuth callback will be:
`https://portefeuille-psi.vercel.app/auth/github/callback`.

The worker image is built from Dockerfile.worker and sets PROCESS_ROLE=worker. It requires its own
WORKER_DATABASE_URL in production; API processes keep PROCESS_ROLE=api (the default) and DATABASE_URL.
Standard `postgres://` and `postgresql://` connection strings are normalized to psycopg automatically.
Connection strings and provider keys stay in the hosting secret store. Keep the migration administrator
login out of the worker. Use scoped environment settings wherever available.

### Rebuild after approval

Create a Deploy Hook for the existing Vercel project's main branch and store its secret URL as
VERCEL_DEPLOY_HOOK for the worker. Then set REBUILD_ON_PUBLISH=true for the API. Approval atomically
creates a rebuild job alongside the publication; repeated approval requests do not create extra jobs.
The worker POSTs only to the configured api.vercel.com deploy-hook URL, with retries on failure.
No URL secret is saved in job payloads or shown in the studio. An interrupted request can trigger the
same approved content more than once, because external delivery is at-least-once.

In the studio, a rebuild job marked done means Vercel accepted the trigger, NOT that deployment finished.
Use Vercel's deployment status to verify completion. If the hook fails, the approved API version remains
available and the old static site stays live until a successful rebuild. Full deployment-status polling
is not implemented yet.

The worker drains its current job on SIGTERM and polls at most once every 15 seconds while idle by
default (WORKER_POLL_SECONDS). Polling keeps a managed database active; review the database's free-tier
compute limits before leaving a worker running continuously.
