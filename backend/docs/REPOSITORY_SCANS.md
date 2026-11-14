# Repository case-study drafts

Selected public GitHub repositories can be scanned directly, without another login or a personal
access token. `GITHUB_SCAN_REPOSITORIES` is a comma-separated allowlist of numeric repository IDs
whose source code the owner explicitly permits the configured AI provider to analyze. A repository
must also be connected to the project with `allow_ai=true`. Permission for PR descriptions alone
does not enable full source scans. Emptying the allowlist stops future scans and queued analysis.

For Conduit, the owner selected `KhushiBagga20/Conduit`, numeric ID `1370914882`, for the `conduit`
project. Azure is configured as the provider. Set the allowlist only in Production and redeploy.

The existing authenticated daily Vercel cron checks the default branch. A new commit queues one
scan, deduplicated by repository, commit, provider, deployment and prompt version. Studio also has
**Check GitHub & draft case study**. It reuses existing completed scans; an explicit owner click
can retry a failed scan. A stale draft must be rebased/reviewed before publishing. There is no
automatic publication and the worker retains no publication-write privileges.

Each scan downloads a commit-pinned archive from GitHub and reads eligible text files without
extracting or executing them. Limits: 20 MB compressed, 40 MB expanded, 5,000 archive entries,
320 eligible files, 160 KB per file, and 1.6 MB total selected source. Files are split into sections
of at most 80,000 characters, with at most 32 sections. Secret-looking files/content, binaries,
generated files, dependencies and links are skipped and listed in private coverage metadata.
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
architecture diagram in a private revision. Personal context, media, updates, timeline and reflection
are retained from the owner's published baseline. Source citations are pinned to the inspected
commit and validated against inspected file paths. This validates provenance, not the truth of every
claim. The model must distinguish documentation, implementation, test definitions and inference;
tests are not executed. Questions about motivation, research and outcomes remain for the owner.

Studio shows coverage, citations, questions, progress and safe diagnostics. Public interactions and
the exact-hash approval workflow are unchanged. The current GitHub connection supports public
source snapshots; it does not import commit/PR history or private repos. Existing signed PR/release
webhooks remain a separate evidence stream. GitHub App installation and push-triggered scans can
be added later if private access or immediate updates are needed. Daily polling is active instead.

Unauthenticated GitHub requests have an IP-based rate limit. GitHub throttling respects its reset
or Retry-After header. Failed scheduled checks return 503 after dispatching existing jobs; the next
daily check or owner action can recover. There is no paid hosting upgrade or new hosted service.
