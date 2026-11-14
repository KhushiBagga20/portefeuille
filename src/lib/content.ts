// ─────────────────────────────────────────────
// The content layer.
//
// Every page asks for its content through the functions in this file — never by importing
// a data file directly. Today each function reads local data; when the "living portfolio"
// backend exists, swap the body of a function for a `fetch()` and nothing else changes.
// That is also why they are all `async` and return plain, JSON-shaped records
// (the shapes are in ./types.ts).
//
// Drafts (`status: 'draft'`) are shown while developing (`npm run dev`) and left out of
// the built site.
// ─────────────────────────────────────────────
import { caseStudies } from '../data/case-studies';
import { playlist } from '../data/music';
import type { RoomId } from '../data/playground';
import { archive, projects } from '../data/projects';
import { caseSections, mindBranches } from './types';
import type { ArchiveItem, CaseSectionId, CaseStudy, MindBranch, MindNode, Project } from './types';

/** drafts are visible in development only */
export const showDrafts = import.meta.env.DEV;
export const isLive = <T extends { status?: 'draft' | 'published' }>(item: T) => showDrafts || item.status !== 'draft';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Opt in at build time. Leave unset while migrating: the current local content stays live.
const apiUrl = import.meta.env.PORTFOLIO_API_URL?.replace(/\/$/, '');
async function published<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}/api/v1${path}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Portfolio content unavailable (${response.status}) at ${path}`);
  return response.json() as Promise<T>;
}

// ── projects ─────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  if (apiUrl) return published<Project[]>('/projects');
  return projects.filter(isLive);
}

export async function getProject(slug: string): Promise<Project | undefined> {
  return (await getProjects()).find((p) => p.slug === slug);
}

export async function getArchive(): Promise<ArchiveItem[]> {
  return archive;
}

// ── case studies ─────────────────────────────

export async function getCaseStudy(slug: string): Promise<CaseStudy> {
  if (apiUrl) return published<CaseStudy>(`/projects/${encodeURIComponent(slug)}/case-study`);
  const found = caseStudies.filter(isLive).find((c) => c.slug === slug);
  // a project with no case-study file still gets a page: an honest, empty one
  return found ?? { slug, status: 'published', intro: {} };
}

/** The mind map a case study shows: its six branches, with anything left out marked empty.
 *  `implementation` falls back to the feature groups, so a new project gets a map for free. */
export function mindMapOf(study: CaseStudy): { branch: MindBranch; nodes: MindNode[] }[] {
  return mindBranches.map((branch) => {
    const given = study.mindmap?.[branch];
    if (given?.length) return { branch, nodes: given };
    if (branch === 'implementation' && study.features?.length) {
      return {
        branch,
        nodes: study.features.map((g) => ({ label: g.title, stage: g.stage, children: g.items.map((label) => ({ label })) })),
      };
    }
    if (branch === 'future') {
      const planned = (study.timeline ?? []).filter((m) => m.stage === 'planned').map((m) => ({ label: m.title, note: m.body, stage: m.stage }));
      return { branch, nodes: planned };
    }
    return { branch, nodes: [] };
  });
}

/** Which sections of a case study have something in them, and what is still to be written. */
export function caseOutline(project: Project, study: CaseStudy) {
  const map = mindMapOf(study);
  const written = map.filter((b) => b.nodes.length).length;
  const dives = study.deepDives ?? [];
  const r = study.reflection ?? {};
  const has: Record<CaseSectionId, boolean> = {
    brief: true,
    features: Boolean(study.features?.length),
    architecture: Boolean(study.diagrams?.length),
    // a map with one branch is a list: wait until there are at least two
    thinking: written >= 2,
    timeline: Boolean(study.timeline?.length || study.updates?.length),
    'deep-dives': dives.length > 0,
    reflection: Boolean(r.worked?.length || r.didnt?.length || r.learned?.length || r.improve?.length),
  };

  // what the reader is told is still on its way, in plain words
  const missing: string[] = [];
  if (!project.oneLiner) missing.push('A one-line description');
  if (!study.intro.problem?.length) missing.push('The problem it sets out to solve');
  if (!study.intro.built?.length) missing.push('What was built, and why');
  if (!project.role) missing.push('My role and contribution');
  if (!project.stack?.length) missing.push('Technologies');
  if (!study.intro.media?.length) missing.push('Screenshots or a demo');
  if (!project.links.github && !project.links.demo) missing.push('Links to the code or a live version');
  if (!has.features) missing.push('What it does, feature by feature');
  if (!has.architecture) missing.push('An architecture diagram');
  if (!has.thinking) missing.push('How the idea took shape: research, challenges, decisions');
  else for (const b of map) if (!b.nodes.length && b.branch !== 'implementation' && b.branch !== 'future') missing.push(`How it took shape: ${b.branch}`);
  if (!has.timeline) missing.push('A development timeline');
  else if (!(study.timeline ?? []).some((m) => m.stage === 'planned')) missing.push('What is planned next');
  if (!dives.length) missing.push('Technical deep dives');
  else if (dives.some((d) => !d.body?.length)) missing.push(`Deep-dive notes: ${dives.filter((d) => !d.body?.length).map((d) => d.title).join('; ')}`);
  if (!has.reflection) missing.push('Reflection: what worked, what didn’t, what I learned, what I’d improve');

  const sections = caseSections.filter((s) => has[s.id]);
  return { has, sections, missing, map };
}

// ── the Playground ───────────────────────────

/** the one-line stock count each room shows on its door */
export async function roomNotes(): Promise<Record<RoomId, string>> {
  return {
    lab: plural(1, 'experiment'),
    art: '',
    writing: '',
    records: plural(playlist.tracks.length, 'track'),
    films: '',
  };
}
