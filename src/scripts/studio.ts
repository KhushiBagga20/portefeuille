import type { CaseStudy, Project } from '../lib/types';

type Content = { project: Project; caseStudy: CaseStudy };
type Revision = { id: string; base_version: number; content: Content; content_hash: string; source: string; review_notes: { questions?: string[]; warning?: string; coverage?: { commit: string; inspected: { path: string }[]; skipped: { path: string; reason: string }[] }; citations?: { claim: string; basis: string; sources: string[] }[] }; created_at: string };
type Repository = { id: string; full_name: string; scan_enabled: boolean };
type ProjectState = { slug: string; version: number };
type Evidence = { id: string; title: string; excerpt: string; source_url: string };
type Publication = { version: number; snapshot: Content };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const root = el<HTMLElement>('studio');
const apiOrigin = (root.dataset.api ?? '').replace(/\/$/, '');
const projectSelect = el<HTMLSelectElement>('project');
const revisionSelect = el<HTMLSelectElement>('revision');
const editor = el<HTMLTextAreaElement>('content');
const titleInput = el<HTMLInputElement>('update-title');
const bodyInput = el<HTMLTextAreaElement>('update-body');
let csrf = '';
let projects: ProjectState[] = [];
let revisions: Revision[] = [];
let selected: Revision | undefined;
let baseline: Revision | undefined;
let dirty = false;
let busy = false;
let publishKey = crypto.randomUUID();

function notice(message: string) { el('notice').textContent = message; }
function currentProject() { return projects.find(p => p.slug === projectSelect.value); }
function route(suffix = '') { return `/api/v1/studio/projects/${encodeURIComponent(projectSelect.value)}${suffix}`; }
function controls() {
  root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea').forEach(node => { node.disabled = busy; });
  const pending = Boolean(titleInput.value.trim() || bodyInput.value.trim());
  el<HTMLButtonElement>('publish').disabled = busy || dirty || pending || !selected?.id || selected.base_version !== currentProject()?.version;
  el<HTMLButtonElement>('save').disabled = busy || pending || !selected;
  el<HTMLButtonElement>('generate').disabled = busy || !currentProject()?.version;
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      el('workspace').hidden = true; el('login').hidden = false; csrf = '';
    }
    const detail = typeof data.detail === 'string' ? data.detail : (response.status === 404 && path === '/auth/session' ? 'Backend not connected yet. Configure the API URL and hosting routes using the setup guide.' : 'The content could not be accepted. Check the fields and try again.');
    throw new Error(response.status === 409 ? `${detail}. Refresh and review before publishing again.` : detail);
  }
  return data as T;
}
async function perform(action: () => Promise<void>) {
  if (busy) return;
  busy = true; controls();
  try { await action(); } catch (error) { notice(error instanceof Error ? error.message : 'Something went wrong. Try again.'); }
  finally { busy = false; controls(); }
}
// Render all candidate fields as text, never HTML. Private evidence is a separate panel.
function contentTree(value: unknown): HTMLElement {
  const wrapper = document.createElement('div');
  if (Array.isArray(value)) {
    const list = document.createElement('ul');
    for (const item of value) { const li = document.createElement('li'); li.append(contentTree(item)); list.append(li); }
    wrapper.append(list);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const label = document.createElement('strong'); label.textContent = key.replace(/([A-Z])/g, ' $1');
      wrapper.append(label, contentTree(item));
    }
  } else { const p = document.createElement('p'); p.textContent = String(value ?? ''); wrapper.append(p); }
  return wrapper;
}
function preview() {
  try { el('preview').replaceChildren(contentTree(JSON.parse(editor.value))); }
  catch { el('preview').textContent = 'The content is not valid JSON yet. Fix it before saving.'; }
}
function selectRevision(revision: Revision) {
  selected = revision; dirty = false; publishKey = crypto.randomUUID();
  editor.value = JSON.stringify(revision.content, null, 2);
  titleInput.value = ''; bodyInput.value = '';
  el('review-notes').textContent = (revision.review_notes.questions ?? []).join(' • ');
  const notes = revision.review_notes;
  const sources = el('source-review'); sources.replaceChildren();
  if (notes.warning) { const p = document.createElement('p'); p.textContent = notes.warning; sources.append(p); }
  if (notes.coverage) {
    const p = document.createElement('p'); p.textContent = `Commit ${notes.coverage.commit.slice(0, 12)} · ${notes.coverage.inspected.length} files inspected · ${notes.coverage.skipped.length} skipped. Tests were not executed.`; sources.append(p);
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Scan coverage';
    details.append(summary, contentTree(notes.coverage)); sources.append(details);
  }
  for (const citation of notes.citations ?? []) {
    const p = document.createElement('p'); p.textContent = `${citation.claim} (${citation.basis})`; sources.append(p);
    for (const url of citation.sources) {
      if (!url.startsWith('https://github.com/')) continue;
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = decodeURIComponent(url.split('/blob/')[1] ?? url); sources.append(link, document.createElement('br'));
    }
  }
  preview(); controls();
}
function hasUnsaved() { return dirty || Boolean(titleInput.value.trim() || bodyInput.value.trim()); }
function mayDiscard() { return !hasUnsaved() || confirm('Discard your unsaved changes?'); }
async function loadProject() {
  selected = undefined;
  if (!currentProject()) { notice('No projects yet. Import your existing content using the backend setup instructions.'); return; }
  const [drafts, evidence, history, jobs, repositories] = await Promise.all([
    request<Revision[]>(route('/revisions')), request<Evidence[]>(route('/evidence')),
    request<Publication[]>(route('/publications')),
    request<{ kind: string; status: string; error?: string; progress?: string }[]>('/api/v1/studio/jobs'),
    request<Repository[]>(route('/repositories')),
  ]);
  revisions = drafts; revisionSelect.replaceChildren();
  drafts.forEach(r => revisionSelect.add(new Option(`${r.source} · ${new Date(r.created_at).toLocaleString()}`, r.id)));
  const live = history.find(p => p.version === currentProject()!.version);
  baseline = live ? { id: '', base_version: live.version, content: live.snapshot, content_hash: '', source: 'published', review_notes: {}, created_at: '' } : undefined;
  if (baseline) revisionSelect.add(new Option('Current publication · start a new draft', ''));
  if (drafts[0]?.base_version === currentProject()!.version) selectRevision(drafts[0]);
  else if (baseline) { revisionSelect.value = ''; selectRevision(baseline); }
  else if (drafts[0]) selectRevision(drafts[0]);
  el('version').textContent = `Published API version: ${currentProject()!.version} · Website deployment tracked separately`;
  el('evidence').replaceChildren();
  for (const item of evidence) {
    const label = document.createElement('label'); const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.value = item.id;
    const text = document.createElement('span'); text.textContent = ` ${item.title}`;
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Read source description';
    const excerpt = document.createElement('p'); excerpt.textContent = item.excerpt;
    details.append(summary, excerpt); label.append(checkbox, text, details); el('evidence').append(label);
  }
  if (!evidence.length) el('evidence').textContent = 'No GitHub activity received yet.';
  el('jobs').replaceChildren(...jobs.map(j => { const p = document.createElement('p'); p.textContent = `${j.kind}: ${j.status} ${j.progress ?? ''}${j.error ? ` (${j.error})` : ''}`; return p; }));
  el('repository-scans').replaceChildren();
  for (const repo of repositories.filter(r => r.scan_enabled)) {
    const p = document.createElement('p'); p.textContent = `${repo.full_name} · Checked daily for new commits.`;
    const button = document.createElement('button'); button.textContent = 'Check GitHub & draft case study';
    button.onclick = () => void perform(async () => {
      const result = await request<{ status: string }>(route(`/repositories/${encodeURIComponent(repo.id)}/scan`), {});
      notice(result.status === 'done' ? 'This commit is already analyzed. Refresh to review its saved draft.' : 'Repository analysis queued. Refresh to follow section progress and review the finished draft.');
    });
    el('repository-scans').append(p, button);
  }
  el('history').replaceChildren();
  for (const publication of history) {
    const button = document.createElement('button'); button.textContent = `Restore version ${publication.version} as a draft`;
    button.onclick = () => { if (!mayDiscard()) return; void perform(async () => {
      const revision = await request<Revision>(route('/revisions'), { content: publication.snapshot, base_version: currentProject()!.version });
      await loadProject(); revisionSelect.value = revision.id; selectRevision(revision);
      notice('Restored into a private revision. Review the preview before approving it.');
    }); };
    el('history').append(button);
  }
  notice('Your drafts are private. Choose a revision or add an update.');
}
async function refreshProjects() {
  const slug = projectSelect.value;
  projects = await request<ProjectState[]>('/api/v1/studio/projects');
  projectSelect.replaceChildren(...projects.map(p => new Option(p.slug, p.slug)));
  if (projects.some(p => p.slug === slug)) projectSelect.value = slug;
  await loadProject();
}
el<HTMLAnchorElement>('login-link').href = `${apiOrigin}/auth/github`;
projectSelect.onchange = () => { if (!mayDiscard()) { projectSelect.value = selected?.content.project.slug ?? ''; return; } void perform(loadProject); };
revisionSelect.onchange = () => { if (!mayDiscard()) { revisionSelect.value = selected?.id ?? ''; return; } const r = revisionSelect.value === '' ? baseline : revisions.find(r => r.id === revisionSelect.value); if (r) selectRevision(r); };
editor.oninput = () => { dirty = true; preview(); controls(); };
titleInput.oninput = bodyInput.oninput = controls;
el('append').onclick = () => {
  if (!titleInput.value.trim()) { notice('Give the update a title first.'); return; }
  try {
    const content = JSON.parse(editor.value) as Content;
    const date = new Date().toISOString().slice(0, 10);
    (content.caseStudy.updates ??= []).push({ date, title: titleInput.value.trim(), body: bodyInput.value.trim() });
    content.caseStudy.updated = date;
    editor.value = JSON.stringify(content, null, 2); titleInput.value = ''; bodyInput.value = ''; dirty = true;
    preview(); controls(); notice('Update added to your draft. Save a revision to review it for publication.');
  } catch { notice('Fix the full content JSON before adding an update.'); }
};
el('save').onclick = () => void perform(async () => {
  if (!selected) return;
  const revision = await request<Revision>(route('/revisions'), { content: JSON.parse(editor.value), base_version: selected.base_version, parent_id: selected.id || undefined });
  await loadProject(); revisionSelect.value = revision.id; selectRevision(revision); notice('Revision saved privately. Review every field before publishing.');
});
el('publish').onclick = () => void perform(async () => {
  if (!selected || dirty || titleInput.value.trim() || bodyInput.value.trim()) throw new Error('Save and review your changes first.');
  const result = await request<{ version: number }>(route('/publications'), { revision_id: selected.id, content_hash: selected.content_hash, expected_version: selected.base_version, idempotency_key: publishKey });
  await refreshProjects(); notice(`Version ${result.version} published to the API. Rebuild the website to display it there.`);
});
el('generate').onclick = () => void perform(async () => {
  const evidence_ids = [...el('evidence').querySelectorAll<HTMLInputElement>('input:checked')].map(input => input.value);
  if (!evidence_ids.length) throw new Error('Select at least one source first.');
  await request(route('/generations'), { evidence_ids, base_version: currentProject()!.version });
  notice('Draft generation queued. Keep the backend worker running, then refresh to see the result.');
});
el('refresh').onclick = () => { if (mayDiscard()) void perform(refreshProjects); };
el('logout').onclick = () => { if (!mayDiscard()) return; void perform(async () => {
  await request('/auth/logout', {}); csrf = ''; el('workspace').hidden = true; el('login').hidden = false; notice('Signed out.');
}); };
el<HTMLFormElement>('repo-form').onsubmit = event => {
  event.preventDefault(); void perform(async () => {
    await request(route('/repositories'), { github_id: el<HTMLInputElement>('repo-id').value.trim(), full_name: el<HTMLInputElement>('repo-name').value.trim(), allow_ai: el<HTMLInputElement>('repo-ai').checked });
    notice('Repository connected. Configure its webhook using the backend setup guide.');
  });
};
window.addEventListener('beforeunload', event => { if (hasUnsaved()) event.preventDefault(); });
void perform(async () => {
  try {
    const session = await request<{ csrf_token: string }>('/auth/session'); csrf = session.csrf_token;
    el('login').hidden = true; el('workspace').hidden = false; await refreshProjects();
  } catch (error) {
    el('login').hidden = false;
    notice(error instanceof TypeError ? 'Backend unavailable. Start it locally or configure PUBLIC_API_ORIGIN for your deployed backend.' : (error as Error).message);
  }
});
