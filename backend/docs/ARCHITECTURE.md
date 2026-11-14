# Backend architecture and boundaries

```text
GitHub --> signed webhook --> deliveries + jobs (atomic)
                                  |
                              worker
                                  |
                               evidence
                                  |
Owner selects evidence --> generation job --> private revision
                                                   |
                                  owner edits / previews exact content
                                                   |
                                   approve hash + expected base version
                                                   |
                                       immutable publication
                                                   |
                               public API --> Astro build --> hosted site
```

## Database

Projects contain identity and a monotonically increasing current publication version.
Revisions contain immutable full Project/CaseStudy candidates, their hash, base version and optional
parent revision. Full snapshots reuse the existing frontend structure rather than forcing its fixed
case-study sections into a new block editor. JSON content is strictly validated by Pydantic.

Publications reference the approved revision and store its public snapshot, approval actor, time,
idempotency key and per-project version. Approval and publication are a single transaction. There is
no intermediate boolean that a worker can accidentally switch to publish. Rollback also adds a version.

Repositories belong to projects; deliveries belong to repositories. Evidence has a unique repository
and external source key. RevisionEvidence links AI proposals to source evidence. Jobs have unique
input fingerprints, attempts, leases and fencing tokens. OwnerSessions store only hashes of random
session cookies, CSRF tokens and expiry times.

Important indexes: project slug, project publication version, repository GitHub ID, delivery ID,
repository evidence source key, job deduplication key and job status.

## Consistency

Publication updates Project.version only if it still equals the preview's expected version. The
snapshot insert commits with that change. Conflicts return 409; the owner must review a rebase.
A repeated successful idempotency key returns the original result if all request fields match.

Workers claim rows with SELECT FOR UPDATE SKIP LOCKED on PostgreSQL. A crashed worker's job becomes
claimable after a five-minute lease. Every completion checks its fencing token and lease before commit.
There are at most three attempts, with exponential delay. No provider response content is stored in errors.
The default SQLite tests exercise most behavior, but PostgreSQL is required for concurrent workers.

## Security

- Private API access checks the configured owner ID on every request, not just at login.
- OAuth state + PKCE, signed short-lived flow cookie, random server-side login sessions.
- HTTP-only cookies; Secure in production; SameSite=Lax; 12-hour session expiration.
- Mutations require a known Origin and CSRF token. No wildcard credentialed CORS.
- Every public response comes from publications, not draft records. All responses default to no-store.
- Webhook HMAC-SHA256 is verified against raw bounded bytes before JSON is trusted.
- Repository IDs are allowlisted independently of the webhook signature.
- Public schemas reject private todo/unknown fields and non-HTTP(S)/relative media URLs.
- Model sees selected repository descriptions only after explicit AI consent; it cannot call tools.
- Apply scripts/worker-role.sql and a separate worker login to enforce publish separation in PostgreSQL.

Remaining limitations: no automatic secret scanner, no GitHub installation token retrieval, no external
rate limiting, no alerting/backups provisioned, and no deploy/rebuild trigger. Human review remains the
accuracy and disclosure gate. Structured output and source IDs do not guarantee that prose is true.

## Extension order

1. Configure credentials and build the studio against the existing endpoints.
2. Wire Astro content.ts and add a durable, authenticated rebuild job plus deployment status.
3. Add GitHub installation records/token exchange, missed-event reconciliation, and direct commits.
4. Add optional scheduled digests and cost budgets with per-project opt-in.
5. Add asset storage, granular source citations and gallery/writing content types.

Do not migrate the frontend framework or rewrite interaction components to add any of these features.
