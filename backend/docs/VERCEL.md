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
