# Deploying portefeuille on Vercel

The root vercel.json deploys the Astro frontend and FastAPI service with private queue subscribers. Import
https://github.com/KhushiBagga20/portefeuille with root directory `.` and production branch `main`.
Leave PORTFOLIO_API_URL empty for the first deployment so the existing projects stay visible.
The studio page is included; GitHub OAuth credentials are configured in Vercel Production.

## Full application

Vercel currently supports FastAPI services and long-running Daemons (both the multi-service model and
Daemons are beta). This app uses Vercel Queues push subscribers for jobs, so no always-on worker
is needed. PostgreSQL must be a managed external database, not a file inside a function/container.

The proposed full setup uses one public domain with routes `/api/*`, `/auth/*`, `/webhooks/*`, `/health`,
`/docs` and `/openapi.json` directed to the FastAPI service. All other routes go to Astro. This keeps
owner cookies on the same site. The API service root is backend/ and entrypoint is app.main:app.
The private subscriber is app.queue_subscriber, registered in backend/pyproject.toml. It uses a
restricted worker login. The CLI worker remains available for local development.

Before enabling this setup:

1. Connect the Vercel account/project and confirm Services/Queues support. Enable project OIDC for
   queue authentication and set QUEUE_ENABLED=true and a strong CRON_SECRET in Production.
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
9. Create a Vercel Deploy Hook for main and configure VERCEL_DEPLOY_HOOK for the worker.
   Set REBUILD_ON_PUBLISH=true only after a worker is running. Publishing already queues a rebuild
   atomically; deployment completion must still be checked in Vercel.

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

## Provisioning status — 2026-11-14

- Existing Vercel project: `portefeuille` (`prj_Sj6sPhNAfbJNJqRVbc2UubW51aTQ`), team
  `khushibagga20s-projects`. Public frontend: https://portefeuille-psi.vercel.app/.
- Neon Free project: `spring-math-74868652`, PostgreSQL 18, AWS us-east-1, fixed 0.25 CU,
  with the free plan's default idle suspension. Database: `portfolio`.
- Production branch: `br-patient-union-bbxd8j2x`. Migration `456462b07c49` was first applied
  successfully to isolated `deployment-check` (`br-dark-bread-bb5rravb`), then to production.
- Six existing projects imported as private revisions; zero publications. The public site still
  reads its checked-in content until the owner reviews and publishes the database baselines.
- Separate `portfolio_api` and `portfolio_worker_login` database logins created. Neither has
  superuser, role-creation, database-creation, or RLS-bypass privileges. Worker publication writes
  and session reads were verified denied.
- Production-only Vercel variables configured: DATABASE_URL, WORKER_DATABASE_URL, ENVIRONMENT,
  OWNER_GITHUB_ID, FRONTEND_ORIGIN, BACKEND_ORIGIN, SESSION_SECRET, GITHUB_WEBHOOK_SECRET and
  REBUILD_ON_PUBLISH=false, QUEUE_ENABLED=true and CRON_SECRET. Project OIDC is enabled, with
  functions in iad1. Database credentials and generated secrets are stored as Secret values.
  Preview deployments have not been given production credentials.
- GitHub OAuth client ID and client secret are configured in Vercel Production.
- Still required: API deployment/health and login verification, owner
  baseline approval, an active job consumer, selected repository webhooks, AI provider credentials,
  and a deploy hook. No paid plan has been enabled.

The root configuration enables frontend/API services and queue processing. Do not switch
PORTFOLIO_API_URL on while publications are empty: doing so would remove the projects from the build.

### Background processing on free plans

Do not leave the polling daemon running continuously on a free setup. Vercel Hobby includes 420
GB-hours of daemon provisioned memory per month, which cannot cover a 1 GiB instance for a full month.
Polling also prevents Neon's database from suspending. The full configuration therefore uses private
Vercel Queues subscribers instead of a daemon, retaining Postgres jobs, leases, fencing, and the
restricted worker login. Normal delivery begins after a job is committed. Failed sends leave the
job in Postgres; a daily authenticated cron re-dispatches pending jobs, including expired leases.
The owner can also POST /api/v1/studio/jobs/dispatch with their session, Origin and CSRF token.
Only job IDs enter the queue. Duplicate deliveries do not repeat completed database writes, and
work stops after three execution attempts. Queue outages can delay processing until reconciliation.
Local tests exercise actual SDK push delivery, retries, duplicates, and outage recovery; hosted
subscriber creation still needs verification on the first full deployment.

References: https://vercel.com/docs/daemons/limits and https://vercel.com/docs/queues/python-sdk.

## Full application configuration

`deployment/vercel.full.json` is mirrored at the REPOSITORY ROOT as `vercel.json`. Its paths are relative to the repository root, not to
this file's directory. It routes the public site, studio login, webhooks and API under the same domain.
It uses Python queue subscribers and a once-daily reconciliation cron, with no daemon instances.
OAuth credentials, queue authentication and database connections are configured for Production only.

For this portfolio, the verified public settings are:

```text
FRONTEND_ORIGIN=https://portefeuille-psi.vercel.app
BACKEND_ORIGIN=https://portefeuille-psi.vercel.app
OWNER_GITHUB_ID=245793203
```

The GitHub OAuth callback will be:
`https://portefeuille-psi.vercel.app/auth/github/callback`.

The queue subscriber always connects using WORKER_DATABASE_URL, independently of the API engine.
For optional self-hosting, Dockerfile.worker sets PROCESS_ROLE=worker and requires the same restricted
connection. API processes keep PROCESS_ROLE=api (the default) and DATABASE_URL.
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

The optional CLI worker drains its current job on SIGTERM and polls every 15 seconds by default
(WORKER_POLL_SECONDS). Do not run it continuously alongside the hosted push subscriber.
