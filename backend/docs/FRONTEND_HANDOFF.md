# Handoff to the frontend developer

## Verified existing structure

The portfolio is Astro 7, not React. All project reads already pass through async functions in
`src/lib/content.ts`; shapes are defined in `src/lib/types.ts`. Project pages use getStaticPaths.
Preserve the keyboard, cube, vinyl, project navigation, mindmap and architecture interactions.
The backend lives in backend/. The studio is src/pages/studio.astro + src/scripts/studio.ts.
The content adapter in src/lib/content.ts is enabled only when PORTFOLIO_API_URL is configured.

## Public adapter contract

| Existing function | Endpoint | Result |
|---|---|---|
| getProjects() | GET /api/v1/projects | Project[] |
| getProject(slug) | GET /api/v1/projects/{slug} | Project, or 404 |
| getCaseStudy(slug) | GET /api/v1/projects/{slug}/case-study | CaseStudy, or 404 |

Set a server-only PORTFOLIO_API_URL when implementing the adapter. The public API needs no credentials.
Keep archive, playlist and playground content local for now. Diagram field aliases, optional fields,
caseStudy.updates, stage values and colors match the current TypeScript interface.
The API omits null fields and private todo notes; do not expect notes or evidence in public responses.

Enable PORTFOLIO_API_URL only after the desired initial projects have
been imported AND approved. The API returns an empty list until then. Avoid silently mixing old local
content and new backend publications in production; show an intentional error or fail the build while
keeping the last successful deployment live. During migration, a deliberate local/API feature flag is fine.

## Static publication caveat

Fetching these endpoints inside getStaticPaths runs during `astro build`, not on every page visit.
Choose one deployment strategy:

1. Keep static Astro: after publication, trigger an authenticated hosting rebuild and track its outcome.
   A durable rebuild job is a future integration; not implemented or configured here.
2. Introduce an Astro server adapter for selected routes and move content fetching to request time.

Do not tell the owner the website is updated merely because the backend publication succeeded.
The studio should distinguish “published to API” from “deployed to website”.

## Private studio contract

Every request includes cookies. For writes, get csrf_token from GET /auth/session and include
X-CSRF-Token. The browser supplies Origin; the backend checks it against the configured origins.
The private API does not use the frontend's development-only showDrafts behavior.

- GET /auth/github — navigate here to log in (not a fetch).
- GET /auth/session — owner ID, CSRF token, expiry.
- POST /auth/logout — revoke the session.
- GET /api/v1/studio/projects — project slugs and current publication versions.
- POST /api/v1/studio/projects — `{content: {project, caseStudy}, base_version: 0}`; returns private revision.
- GET /api/v1/studio/projects/{slug}/revisions — latest 100 private revisions.
- POST /api/v1/studio/projects/{slug}/revisions — `{content, base_version, parent_id?}`.
- GET /api/v1/studio/projects/{slug}/publications — publication history and snapshots (latest 100).
- POST /api/v1/studio/projects/{slug}/publications — `{revision_id, content_hash, expected_version, idempotency_key}`.
- POST /api/v1/studio/projects/{slug}/repositories — `{github_id: "123", full_name: "owner/repo", allow_ai: false}`.
- GET /api/v1/studio/projects/{slug}/evidence — private supporting sources.
- POST /api/v1/studio/projects/{slug}/generations — `{evidence_ids: ["..."], base_version: 1}`; returns job ID.
- GET /api/v1/studio/jobs — latest 100 jobs with status, attempts and safe error class.

A revision returns id, base_version, parent_id, content, content_hash, source, review_notes and created_at.
The content is already the exact public candidate; status='published' inside this JSON does NOT mean it
is public. Only the publication table makes it public. Never infer workflow state from content.status.

For review: show evidence, editable draft and exact preview. An edit POST creates a new revision and
returns a new hash. Publish only that saved revision. Reuse the same idempotency key for network retries
of the SAME action. 409 means a stale base/hash or conflicting key: reload and ask for a new review.
A pending AI job never publishes. An AI draft based on an older version must be rebased manually.

Treat all text as text. No innerHTML, set:html, executable MDX, or arbitrary scripts from content.
Escape code samples. Use current diagram components, not model-generated HTML/SVG.
Never fetch private endpoints during public page rendering or put owner cookies/API keys into bundles.

## Suggested UI sequence

1. Owner login and project list.
2. Revision editor + public preview + explicit Approve & publish.
3. Publication history and rollback (new draft from old snapshot).
4. Evidence inbox and Generate draft action.
5. Job errors and deployed-site status.

Use /docs or the generated OpenAPI schema for exact request validation. The studio currently provides
full-content JSON editing plus a simpler add-update form, evidence selection, generation, approval and
history restoration. Its preview shows all candidate fields as text; it is not the final page layout.
