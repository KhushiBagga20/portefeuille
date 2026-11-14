# Living portfolio backend

FastAPI + PostgreSQL. No Supabase. A separate backend for the existing **Astro** portfolio.
The frontend includes an owner studio and an opt-in API content adapter. Neon production storage is
provisioned, and the hosted API, owner login and queue consumer are verified. The six owner-approved baselines are published, and approved publications trigger website rebuilds.
Repository webhooks and AI credentials still need configuration. See docs/VERCEL.md.

## What works

- Public Project and CaseStudy JSON matching `src/lib/types.ts`.
- GitHub OAuth owner login, expiring server-side sessions, origin and CSRF checks.
- Private immutable draft revisions; preview hashes, approval/publication, history and rollback through a new revision.
- Atomic publication conflict protection and idempotent publication requests.
- Signed GitHub webhooks for merged default-branch PRs and published non-prerelease releases.
- Repository allowlist, durable jobs, evidence deduplication, retries and expired-lease recovery.
- Vercel Queues push processing with a restricted database login and authenticated daily outbox recovery.
- Explicit owner-triggered AI drafting from selected evidence, with repository-specific consent.
- Existing content export/import as PRIVATE drafts. No content is published automatically.

## Run locally

Requires Python 3.12+, uv, and PostgreSQL. Commands below run inside `backend/`.

```sh
uv sync --locked
cp .env.example .env
# Edit .env with your own settings. Never commit it.
# Optional: docker compose up -d postgres (or use an existing local PostgreSQL installation).
uv run alembic upgrade head
uv run python -m app.import_content examples/current-content.json
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --no-access-log
```

In a second terminal:

```sh
uv run python -m app.worker
```

API docs: http://localhost:8000/docs. Health: http://localhost:8000/health.
The docs permit exploration; mutating owner requests still require the session cookie, trusted Origin,
and X-CSRF-Token. Visit http://localhost:4321/studio/ for the private editor. There is no development authentication bypass.

`examples/current-content.json` contains six projects exported from the supplied frontend on 2026-11-14.
The export excludes private `todo` notes. Review it before approving any publication.
To refresh the export from the frontend without editing frontend files:

```sh
node scripts/export-frontend.cjs .. examples/current-content.json
```

This export uses the frontend's existing esbuild installation. Import skips existing project slugs;
it never overwrites ongoing editing or publishes anything.

## Configure owner login

1. Create a GitHub OAuth app with callback `http://localhost:8000/auth/github/callback` for local use.
2. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and your numeric OWNER_GITHUB_ID in `.env`.
3. Generate SESSION_SECRET using the command in `.env.example`.
4. Visit `/auth/github`. After GitHub authorization, you return to `/studio/`; it fetches the CSRF token from `/auth/session`.
5. All studio POSTs include `credentials: 'include'`, `X-CSRF-Token`, and the trusted browser Origin.

OAuth is for login only; it requests no repository scope and does not persist the GitHub access token.
Only the configured numeric GitHub account can obtain an owner session. Log out with POST `/auth/logout`.
Use the same hostname consistently (localhost and 127.0.0.1 are different cookie hosts).
For production, use HTTPS and frontend/API subdomains on the same site, or a same-origin reverse proxy.
Cross-site third-party cookie hosting is intentionally not supported by this configuration.

## Connect GitHub activity

Use POST `/api/v1/studio/projects/{slug}/repositories` to register a numeric GitHub repository ID and
its full name. Each repository maps to one project in this MVP; a project can have several repositories.
`allow_ai` defaults to false. Set it true only if sending selected titles and description excerpts to
OpenAI is acceptable. No code diffs or complete source files are sent.

Configure a GitHub App (selected repositories, read-only metadata/contents/pull requests) or a repository
webhook to send `pull_request` and `release` events to `/webhooks/github`. Set the same strong webhook
secret in GitHub and GITHUB_WEBHOOK_SECRET. GitHub requires a reachable HTTPS URL; localhost needs a
separately configured tunnel. No tunnel, GitHub App, or external subscription is created by this code.

The worker consumes signed payloads; it does not yet fetch GitHub API details or reconcile missed events.
Use GitHub's delivery redelivery UI to recover missed events in this version.

## Generate and publish

1. Approve/publish the initial project baseline.
2. Receive GitHub events and run the worker; list evidence via the private API.
3. Configure OPENAI_API_KEY and an OPENAI_MODEL supporting JSON Schema structured output.
4. POST selected evidence IDs and current base_version to the generations endpoint.
5. Inspect the new AI revision, its evidence IDs, questions and full candidate content.
6. Edit by POSTing a new revision with parent_id (revisions never change in place).
7. Publish with the exact revision ID, content_hash, expected_version and a new idempotency key.

Generation is manual in this release to keep cost and editorial control explicit. Requests with the
same evidence/model/base version deduplicate. Up to 20 descriptions, 4,000 characters each, are sent;
output is capped at 2,000 model tokens. Failures retry at most three times (possible repeated API charges).
No live OpenAI call was made during implementation. Provider responses and OAuth were tested with fakes.
AI evidence links support the update as a whole, not individual sentence-level claims.

Rollback: retrieve an older snapshot from publication history, save it as a NEW revision with the current
base_version, preview it, then approve/publish. History is retained.

## Tests

```sh
uv run pytest -q
uv run ruff check app tests migrations
```

Default tests use isolated temporary SQLite files. To exercise PostgreSQL locks, use a dedicated EMPTY
test database (tests create and drop application tables; never use your real database):

```sh
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost/portfolio_test uv run pytest -q
```

Migrations are versioned in migrations/versions. Runtime never calls create_all.
Run `uv run alembic check` against an upgraded database to check model/schema drift.

## Remaining integrations

- Configure selected repository webhooks and AI credentials; verify the live drafting flow.
- Keep the studio and production Astro content adapter configured (see docs/FRONTEND_HANDOFF.md).
- Keep the configured VERCEL_DEPLOY_HOOK and REBUILD_ON_PUBLISH=true; Astro renders project pages at BUILD time.
- Keep using the provisioned restricted worker DB login; keep migrations admin-only.
- Add GitHub App installation token enrichment, scheduled reconciliation and direct-commit support.
- Add deployment-specific request rate limits, monitoring, backups, recovery drills and payload retention.
- Add repository disconnect/AI-consent management UI and endpoints before sharing beyond a personal pilot.
- Add stronger automated secret detection if ingesting private repository descriptions. Consent and human
  review are required today; filtering URLs alone does not guarantee confidentiality.
- Add approved asset storage, pagination and fine-grained sentence citations as the portfolio grows.

The production API and queue consumer are deployed; paid AI usage and scheduled AI digests are not enabled. Rebuild jobs and the production API content adapter are enabled. Local development still uses checked-in
content unless PORTFOLIO_API_URL is set. Approved snapshots are available immediately from the API;
the static website updates after the queued rebuild succeeds.

## Reference documentation

- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://docs.sqlalchemy.org/en/20/orm/versioning.html
