# Repository case-study drafts

Selected public GitHub repositories can be scanned directly, without another login or a personal
access token. In Studio, import a repository card, select the project and click **Generate AI case
study**. The button explains source sharing and records `allow_source_ai=true` only after checking
the repository is public, matches its connected numeric ID, and belongs to the signed-in owner.
The request requires the owner session and CSRF protection. It also enables daily checks.
A card may stay private: its immutable revision becomes the first scan's baseline and no publication
is created until the owner explicitly approves the finished draft.

`GITHUB_SCAN_REPOSITORIES` remains a legacy comma-separated source-consent allowlist. Both paths
also require `allow_ai=true`; permission for PR descriptions alone does not enable full scans.
To revoke analysis, set `allow_ai=false`, or clear both persisted source consent and the legacy
allowlist entry. The worker checks permission again before processing a queued scan.

Azure is configured as the provider. Set the allowlist only in Production and redeploy.
The owner has enabled the 12 connected public repositories: Conduit, Sahaas-frontend, Kinetic,
Kinetic-City, EvolveAI-Website, Bad-Influence, LifeAs, commongroundv2, Whered-It-Go, Bhojan,
GSSS-school-site and The-unsaid-page. Mind Pop and VerifAI need repository links first.

The existing authenticated daily Vercel cron checks the default branch. A new commit queues one
scan, deduplicated by repository, commit, provider, deployment and prompt version. Studio also has
**Check all enabled projects now** and a per-project **Generate AI case study** button.
These reuse existing completed scans; an explicit owner click
can retry a failed scan. A stale draft must be rebased/reviewed before publishing. There is no
automatic publication and the worker retains no publication-write privileges.

Each scan downloads a commit-pinned archive from GitHub and reads eligible text files without
extracting or executing them. Limits: 20 MB compressed, 40 MB expanded, 5,000 archive entries,
320 eligible files, 160 KB per file, and 1.6 MB total selected source. Files are split into sections
of at most 80,000 characters, with at most 32 sections. Secret-looking files/content, binaries,
generated files, dependencies and links are skipped and listed in private coverage metadata.
If media makes the archive too large, a commit-pinned GitHub tree selects eligible source files
before downloading them, with at most six parallel fetches and the same file/text budgets.
Truncated or oversized trees are rejected; links and media are never fetched in this fallback.
Detection reduces accidental disclosure but cannot guarantee finding every credential in code.
Only repositories the owner is comfortable sending to the configured AI provider should be enabled.

One AI section request runs per queue delivery; progress commits under the existing five-minute
fenced lease. Completed sections reset the execution-attempt counter, while a failing section
retries at most three times. A crash after an AI response but before commit may repeat that charge.
Completed section summaries are reused when their exact input hash and provider/model/prompt
version match, so later scans analyze changed sections and compose an updated draft. These are
section-level caches, not a claim that only changed lines are sent. Up to 8,000 output tokens are
allowed per section and final synthesis. Raw selected source is held in private job payloads until
its section completes, then discarded; failed jobs may retain unfinished sections. The private
jobs API exposes progress/status, never these payloads. Coverage, citations and summaries persist.

The result updates the technical introduction, features, implementation mindmap, deep dives and
architecture diagram in a private revision. Empty mind-map branches can gain cited product ideas,
documented research, implementation challenges, observed decisions and documented future plans.
Unsupported branches stay empty; future nodes are marked planned. Existing published thinking
branches are preserved. The owner-approved project name, type and description guide composition,
including college-club context and fork attribution. Personal context, media, updates, timeline and reflection
are retained from the owner's published baseline. Source citations are pinned to the inspected
commit and validated against inspected file paths. This validates provenance, not the truth of every
claim. The model must distinguish documentation, implementation, test definitions and inference;
tests are not executed. Questions about motivation, research and outcomes remain for the owner.

Studio shows coverage, citations, questions, progress and safe diagnostics. Public interactions and
the exact-hash approval workflow are unchanged. The current GitHub connection supports public
source snapshots; it does not import commit/PR history or private repos. Existing signed PR/release
webhooks remain a separate evidence stream. GitHub App installation and push-triggered scans can
be added later if private access or immediate updates are needed. Daily polling is active instead.

Each repository check is isolated so a failure cannot roll back checks for other projects.
Unauthenticated GitHub requests have an IP-based rate limit. GitHub throttling respects its reset
or Retry-After header. Failed scheduled checks return 503 after dispatching existing jobs; the next
daily check or owner action can recover. There is no paid hosting upgrade or new hosted service.
