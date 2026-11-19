import type { CaseStudy, Project } from '../lib/types';
import { contentFingerprint } from '../lib/content-fingerprint';

type Content = { project: Project; caseStudy: CaseStudy };
type Revision = { id: string; base_version: number; content: Content; content_hash: string; source: string; review_notes: { questions?: string[]; warning?: string; coverage?: { commit: string; inspected: { path: string }[]; skipped: { path: string; reason: string }[] }; citations?: { claim: string; basis: string; sources: string[] }[] }; created_at: string };
type Repository = { id: string; full_name: string; scan_enabled: boolean };
type ProjectState = { id: string; slug: string; version: number };
type Evidence = { id: string; title: string; excerpt: string; source_url: string };
type Publication = { version: number; revision_id: string; content_hash: string; snapshot: Content };
type Job = { kind: string; status: string; error?: string; progress?: string; project_id?: string; version?: number };
type CatalogRepository = { github_id: string; name: string; full_name: string; description: string; fork: boolean; archived: boolean; project_slug?: string; published: boolean };
type ImportedProject = { slug: string; published: boolean; revision: Revision | null };
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
let publications: Publication[] = [];
let statusBusy = false;
let currentJobs: Job[] = [];
let importedProjects: ImportedProject[] = [];

function notice(message: string) { el('notice').textContent = message; }
function currentProject() { return projects.find(p => p.slug === projectSelect.value); }
function route(suffix = '') { return `/api/v1/studio/projects/${encodeURIComponent(projectSelect.value)}${suffix}`; }
function livePublication() { return publications.find(p => p.version === currentProject()?.version); }
function isPublished(revision: Revision) { return !revision.id || publications.some(p => p.revision_id === revision.id || p.content_hash === revision.content_hash); }
function readyDrafts() { return revisions.filter(r => r.base_version === currentProject()?.version && !isPublished(r)); }
function dateLabel(value: string) { return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function sourceLabel(source: string) { return source === 'github-import' ? 'GitHub project card' : source === 'ai-repository' ? 'Full case study' : source === 'ai' ? 'Short AI update' : 'Edited draft'; }
function controls() {
  root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea').forEach(node => { node.disabled = busy || node.dataset.locked === 'true'; });
  const pending = Boolean(titleInput.value.trim() || bodyInput.value.trim());
  const published = selected ? isPublished(selected) : false;
  const stale = selected?.base_version !== currentProject()?.version;
  el<HTMLButtonElement>('publish').disabled = busy || dirty || pending || !selected?.id || stale || published;
  el<HTMLButtonElement>('publish').textContent = `Publish this draft as version ${(currentProject()?.version ?? 0) + 1}`;
  el<HTMLButtonElement>('save').disabled = busy || pending || !selected || !dirty || stale;
  el<HTMLButtonElement>('generate').disabled = busy || !currentProject()?.version;
  el<HTMLButtonElement>('publish-projects').disabled = busy || !importedProjects.some(p => p.revision && !p.published);
  el<HTMLButtonElement>('latest-draft').disabled = busy || !readyDrafts().length || readyDrafts()[0]?.id === selected?.id;
  el('latest-draft').textContent = readyDrafts()[0]?.id === selected?.id ? 'Latest ready draft selected' : readyDrafts().length ? 'Review latest ready draft' : 'No newer draft available';
  el('version').textContent = currentProject()?.version ? `Version ${currentProject()!.version}` : 'Not published yet';
  el('draft-state').textContent = !selected ? 'No draft selected' : dirty || pending ? 'Unsaved changes' : published ? 'Published content' : stale ? 'Older draft' : 'Private draft · ready';
  el('draft-detail').textContent = !selected ? '' : published ? 'You are viewing already-approved content.' : `${sourceLabel(selected.source)} · ${dateLabel(selected.created_at)}`;
  el('action-help').textContent = !selected ? 'Choose a draft to review first.' : pending ? 'Add your short update to the draft, then save changes.' : dirty ? 'Your edits are not saved. Click Save changes before publishing.' : published ? 'This content is already published. Use Review latest ready draft to see newer work.' : stale ? 'A newer version has been published since this draft was created. Choose the latest ready draft before publishing.' : 'This draft is saved and private. Review it above, then publish directly—there is no need to save it again.';
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(path.endsWith('/scan') ? 60000 : 15000),
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
  try {
    const content = JSON.parse(editor.value) as Content;
    const target = el('preview'); target.replaceChildren();
    const heading = (text: string, level = 'h3') => { const node = document.createElement(level); node.textContent = text; target.append(node); };
    const paragraph = (text: string) => { const node = document.createElement('p'); node.textContent = text; target.append(node); };
    el('preview-title').textContent = content.project.name;
    if (content.project.oneLiner) paragraph(content.project.oneLiner);
    if (content.caseStudy.intro.problem?.length) { heading('The problem'); content.caseStudy.intro.problem.forEach(paragraph); }
    heading('What was built'); (content.caseStudy.intro.built ?? []).forEach(paragraph);
    if (content.caseStudy.features?.length) heading('Features');
    for (const feature of content.caseStudy.features ?? []) { heading(feature.title, 'h4'); if (feature.note) paragraph(feature.note); feature.items.forEach(paragraph); }
    if (content.caseStudy.deepDives?.length) heading('Technical decisions');
    for (const dive of content.caseStudy.deepDives ?? []) { heading(dive.title, 'h4'); if (dive.summary) paragraph(dive.summary); (dive.body ?? []).forEach(paragraph); }
    if (content.caseStudy.diagrams?.length) { heading('Architecture'); for (const diagram of content.caseStudy.diagrams) { heading(diagram.title, 'h4'); if (diagram.caption) paragraph(diagram.caption); paragraph(`Components: ${diagram.nodes.map(n => n.label).join(' · ')}`); } }
    if (content.caseStudy.mindmap && Object.values(content.caseStudy.mindmap).some(nodes => nodes?.length)) {
      heading('Mind map');
      for (const [branch, nodes] of Object.entries(content.caseStudy.mindmap)) {
        if (!nodes?.length) continue;
        heading(branch.charAt(0).toUpperCase() + branch.slice(1), 'h4');
        target.append(contentTree(nodes));
      }
    }
    if (content.caseStudy.updates?.length) { heading('Project updates'); for (const update of content.caseStudy.updates) { heading(`${update.date} · ${update.title}`, 'h4'); if (update.body) paragraph(update.body); } }
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Review every field, including diagrams, timeline and reflection'; details.append(summary, contentTree(content)); target.append(details);
    const base = livePublication()?.snapshot;
    const changed = base ? Object.keys(content.caseStudy).filter(key => JSON.stringify((content.caseStudy as unknown as Record<string, unknown>)[key]) !== JSON.stringify((base.caseStudy as unknown as Record<string, unknown>)[key])).filter(key => key !== 'updated') : [];
    const labels: Record<string, string> = { intro: 'introduction', deepDives: 'technical decisions', mindmap: 'mind map' };
    el('change-summary').textContent = `${content.caseStudy.features?.length ?? 0} feature sections · ${content.caseStudy.deepDives?.length ?? 0} deep dives · ${content.caseStudy.diagrams?.length ?? 0} diagrams${changed.length ? ` · Changes: ${changed.map(k => labels[k] ?? k).join(', ')}` : ''}`;
  }
  catch { el('preview').textContent = 'The content is not valid JSON yet. Fix it before saving.'; }
}
function selectRevision(revision: Revision) {
  selected = revision; dirty = false; publishKey = crypto.randomUUID();
  revisionSelect.value = revision.id;
  editor.value = JSON.stringify(revision.content, null, 2);
  titleInput.value = ''; bodyInput.value = '';
  const questions = document.createElement('ul');
  for (const question of revision.review_notes.questions ?? []) { const li = document.createElement('li'); li.textContent = question; questions.append(li); }
  el('review-notes').replaceChildren(questions);
  if (!questions.children.length) el('review-notes').textContent = 'No additional questions for this draft.';
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
    request<Job[]>('/api/v1/studio/jobs'),
    request<Repository[]>(route('/repositories')),
  ]);
  revisions = drafts; publications = history; revisionSelect.replaceChildren();
  drafts.forEach(r => revisionSelect.add(new Option(`${sourceLabel(r.source)} · ${dateLabel(r.created_at)} · ${isPublished(r) ? 'already published' : r.base_version === currentProject()?.version ? 'ready to publish' : 'older draft'}`, r.id)));
  const live = history.find(p => p.version === currentProject()!.version);
  baseline = live ? { id: '', base_version: live.version, content: live.snapshot, content_hash: '', source: 'published', review_notes: {}, created_at: '' } : undefined;
  if (baseline) revisionSelect.add(new Option(`Published version ${live!.version}`, ''));
  if (readyDrafts()[0]) selectRevision(readyDrafts()[0]);
  else if (baseline) { revisionSelect.value = ''; selectRevision(baseline); }
  else if (drafts[0]) selectRevision(drafts[0]);
  el<HTMLAnchorElement>('live-link').href = `/projects/${encodeURIComponent(projectSelect.value)}/`;
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
  renderJobs(jobs);
  el('repository-scans').replaceChildren();
  if (!repositories.length) {
    const hint = document.createElement('p'); hint.textContent = 'No GitHub repository is connected to this project. Use “Choose which GitHub repositories appear as projects” above to add one.';
    el('repository-scans').append(hint);
  }
  for (const repo of repositories) {
    const p = document.createElement('p'); p.textContent = repo.full_name;
    const hint = document.createElement('p'); hint.className = 'hint';
    hint.textContent = repo.scan_enabled
      ? 'AI analysis is enabled. New commits are checked daily. Existing work is reused when nothing has changed.'
      : 'Clicking Generate allows eligible source files from this public repository to be sent to your configured AI and enables daily checks. AI usage may incur charges. The result stays private until you publish.';
    const button = document.createElement('button'); button.textContent = 'Generate AI case study';
    button.setAttribute('aria-label', `Generate AI case study for ${repo.full_name}`);
    button.onclick = () => void perform(async () => {
      if (hasUnsaved()) throw new Error('Save your current edits before generating a case study.');
      notice('Checking GitHub and preparing your private case study…');
      const result = await request<{ status: string }>(route(`/repositories/${encodeURIComponent(repo.id)}/scan`), { enable_source_analysis: !repo.scan_enabled });
      await loadProject();
      notice(result.status === 'done' ? 'GitHub is up to date. The existing case study has been loaded; no extra AI generation was needed.' : 'AI is writing your private case study, diagram and mind map. Follow Recent activity below. You can leave Studio while it works; nothing is published automatically.');
    });
    el('repository-scans').append(p, hint, button);
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
  notice(readyDrafts().length ? 'Your latest ready draft is selected. Review it, then use the green publish button below.' : 'Your approved content is selected. No newer draft is ready to publish.');
  void checkWebsite();
}

function renderJobs(jobs: Job[]) {
  currentJobs = jobs;
  const relevant = jobs.filter(j => j.project_id === currentProject()?.id).slice(0, 4);
  el('jobs').replaceChildren(...relevant.map(j => {
    const p = document.createElement('p');
    const name = j.kind === 'repository_scan' ? 'Case study' : j.kind === 'generate' ? 'Short update' : 'Website rebuild';
    const state = j.status === 'done' ? (j.kind === 'rebuild' ? 'requested—website status is checked separately' : 'draft ready') : j.status === 'failed' ? 'needs attention' : j.status === 'running' ? 'working' : 'waiting';
    p.textContent = `${name}: ${state}${j.progress && j.status !== 'done' ? ` · ${j.progress}` : ''}${j.error ? ` · ${j.error}` : ''}`; return p;
  }));
  if (!relevant.length) el('jobs').textContent = 'No background work for this project.';
}
async function checkWebsite() {
  const slug = projectSelect.value, publication = livePublication();
  if (!publication) { el('website-state').textContent = 'Not published yet'; el('website-detail').textContent = 'Publish a reviewed draft to create the first version.'; return; }
  try {
    const response = await fetch(`/projects/${encodeURIComponent(slug)}/?studio-check=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unavailable');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const actual = doc.getElementById('portfolio-publication')?.dataset.fingerprint;
    const expected = await contentFingerprint(publication.snapshot);
    if (projectSelect.value !== slug || livePublication()?.version !== publication.version) return;
    const failed = currentJobs.find(j => j.project_id === currentProject()?.id && j.kind === 'rebuild' && j.version === publication.version && j.status === 'failed');
    el('website-state').textContent = actual === expected ? `Version ${publication.version} is live` : failed ? 'Website rebuild needs attention' : 'Website updating';
    el('website-detail').textContent = actual === expected ? 'The public page matches your approved content.' : failed ? 'Your approved content is saved, but the rebuild could not start. See Recent activity; do not publish the same draft again.' : `Version ${publication.version} is approved. Waiting for the website rebuild to display it.`;
  } catch { if (projectSelect.value === slug) { el('website-state').textContent = 'Could not check website'; el('website-detail').textContent = 'Your approved content is saved. Use Open website or try Refresh status.'; } }
}
async function refreshStatus() {
  if (busy || statusBusy || !csrf || document.hidden || el('workspace').hidden) return;
  statusBusy = true; const slug = projectSelect.value;
  try {
    const [states, history, jobs, drafts] = await Promise.all([request<ProjectState[]>('/api/v1/studio/projects'), request<Publication[]>(route('/publications')), request<Job[]>('/api/v1/studio/jobs'), request<Revision[]>(route('/revisions'))]);
    if (projectSelect.value !== slug) return;
    projects = states; publications = history; revisions = drafts;
    renderJobs(jobs); controls(); await checkWebsite();
  } catch { /* Keep the editor and unsaved work intact during a temporary network failure. */ }
  finally { statusBusy = false; }
}
el('latest-draft').onclick = () => { if (mayDiscard() && readyDrafts()[0]) { const draft = readyDrafts()[0]; if (![...revisionSelect.options].some(o => o.value === draft.id)) revisionSelect.add(new Option(`${sourceLabel(draft.source)} · ${dateLabel(draft.created_at)} · ready to publish`, draft.id)); selectRevision(draft); notice('Latest ready draft selected. Review it, then publish using the green button below.'); } };
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
  await refreshProjects(); notice(`Version ${result.version} approved. Your website is rebuilding automatically; watch the Public website status above. You do not need to click Publish again.`);
});
el('generate').onclick = () => void perform(async () => {
  const evidence_ids = [...el('evidence').querySelectorAll<HTMLInputElement>('input:checked')].map(input => input.value);
  if (!evidence_ids.length) throw new Error('Select at least one source first.');
  await request(route('/generations'), { evidence_ids, base_version: currentProject()!.version });
  notice('A private short update is being prepared. Follow Recent activity for progress. Nothing has been published.');
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
el('scan-all').onclick = () => void perform(async () => {
  let queued = 0, ready = 0, failed = 0;
  const status = el('scan-all-status');
  for (const project of projects) {
    status.textContent = `Checking ${project.slug}… ${queued} queued · ${ready} already prepared · ${failed} need retry`;
    try {
      const path = `/api/v1/studio/projects/${encodeURIComponent(project.slug)}`;
      const repos = await request<Repository[]>(`${path}/repositories`);
      for (const repo of repos.filter(r => r.scan_enabled)) {
        try {
          const result = await request<{ status: string }>(`${path}/repositories/${repo.id}/scan`, {});
          if (result.status === 'done') ready++; else queued++;
        } catch { failed++; }
      }
    } catch { failed++; }
    if (!csrf) break;
  }
  status.textContent = `${queued} drafts queued · ${ready} already prepared · ${failed} checks need retry. Queued work continues in the background; nothing is published automatically.`;
});
el('load-repositories').onclick = () => void perform(async () => {
  const repositories = await request<CatalogRepository[]>('/api/v1/studio/github/repositories');
  el('github-catalog').replaceChildren();
  for (const repo of repositories) {
    const label = document.createElement('label'); label.className = 'check';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = repo.github_id;
    const text = document.createElement('span'); text.textContent = `${repo.name}${repo.fork ? ' · fork' : ''}${repo.archived ? ' · archived' : ''}${repo.project_slug ? ` · ${repo.published ? 'published' : 'draft exists'} as ${repo.project_slug}` : ''}${repo.description ? ` — ${repo.description}` : ''}`;
    if (repo.published) { checkbox.disabled = true; checkbox.dataset.locked = 'true'; }
    label.append(checkbox, text); el('github-catalog').append(label);
  }
  el('project-picker-status').textContent = 'Select the repositories you want to add. Existing published projects stay as they are.';
});
function renderImportedProjects() {
  el('project-card-previews').replaceChildren();
  for (const item of importedProjects.filter(p => p.revision && !p.published)) {
    const project = item.revision!.content.project;
    const section = document.createElement('section'); const title = document.createElement('h3'); title.textContent = project.name;
    const description = document.createElement('p'); description.textContent = project.oneLiner || 'No repository description yet. You can edit this project in Studio.';
    const link = document.createElement('p'); link.textContent = `${project.type} · ${project.links.github ?? ''}`;
    section.append(title, description, link); el('project-card-previews').append(section);
  }
}
el('prepare-projects').onclick = () => void perform(async () => {
  if (hasUnsaved()) throw new Error('Save your current edits before adding projects.');
  const repository_ids = [...el('github-catalog').querySelectorAll<HTMLInputElement>('input:checked')].map(n => n.value);
  if (!repository_ids.length) throw new Error('Select at least one repository first.');
  importedProjects = await request<ImportedProject[]>('/api/v1/studio/github/project-drafts', { repository_ids });
  renderImportedProjects(); await refreshProjects();
  const firstDraft = importedProjects.find(p => p.revision && !p.published);
  if (firstDraft) { projectSelect.value = firstDraft.slug; await loadProject(); }
  el('project-picker-status').textContent = 'Cards saved as private drafts. Select a project below and click Generate AI case study in its GitHub connection panel. You can review the full writeup before publishing, or publish just the cards now.';
});
el('publish-projects').onclick = () => void perform(async () => {
  if (hasUnsaved()) throw new Error('Save your current edits before publishing project cards.');
  let count = 0;
  for (const item of importedProjects.filter(p => p.revision && !p.published)) {
    const r = item.revision!;
    await request(`/api/v1/studio/projects/${encodeURIComponent(item.slug)}/publications`, { revision_id: r.id, content_hash: r.content_hash, expected_version: r.base_version, idempotency_key: `github-card-${r.id}` });
    item.published = true; count++;
    el('project-picker-status').textContent = `${count} project cards published. Website rebuilds are being requested.`;
  }
  renderImportedProjects(); await refreshProjects();
  notice(`${count} selected project cards published. They will appear after the website rebuild finishes.`);
});
window.setInterval(() => void refreshStatus(), 20000);
void perform(async () => {
  try {
    const session = await request<{ csrf_token: string }>('/auth/session'); csrf = session.csrf_token;
    el('login').hidden = true; el('workspace').hidden = false; await refreshProjects();
  } catch (error) {
    el('login').hidden = false;
    notice(error instanceof TypeError ? 'Backend unavailable. Start it locally or configure PUBLIC_API_ORIGIN for your deployed backend.' : (error as Error).message);
  }
});
