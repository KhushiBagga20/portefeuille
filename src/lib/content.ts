// ─────────────────────────────────────────────
// The content layer.
//
// Every page asks for its content through the functions in this file — never by importing
// a data file directly. Projects and case studies can already come from the backend (set
// PORTFOLIO_API_URL); everything else reads local data and is written the same way, so it
// can move behind the API by changing the body of one function. That is why they are all
// `async` and return plain, JSON-shaped records (the shapes are in ./types.ts).
//
// Drafts (`status: 'draft'`) are shown while developing (`npm run dev`) and left out of
// the built site.
// ─────────────────────────────────────────────
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { getCollection, type CollectionEntry } from 'astro:content';
import { artworks, collections } from '../data/art';
import { caseStudies } from '../data/case-studies';
import { screenings, shelves } from '../data/films';
import { playlist } from '../data/music';
import type { RoomId } from '../data/playground';
import { archive, projects } from '../data/projects';
import { caseSections, mindBranches } from './types';
import type {
  ArchiveItem,
  Artwork,
  CaseSectionId,
  CaseStudy,
  Collection,
  MindBranch,
  MindNode,
  Project,
  Screening,
  Shelf,
  WritingKind,
  WritingMeta,
} from './types';

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
  if (apiUrl) {
    const live = await published<Project[]>('/projects');
    // Keep the portfolio's existing editorial order; append newly created projects.
    const order = new Map(projects.map((project, index) => [project.slug, index]));
    return live.sort((a, b) => (order.get(a.slug) ?? projects.length) - (order.get(b.slug) ?? projects.length));
  }
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
// The handoff in backend/docs keeps these collections local for now. They are written the
// same way as the project functions all the same, so they can move behind the API later.

const two = (n: number) => String(n).padStart(2, '0');

/** Real entries if there are any; otherwise the labelled samples that ship with the site.
 *  So the first real piece you add replaces the stand-ins without anything being deleted. */
function realOrSamples<T extends { sample?: boolean; status?: 'draft' | 'published' }>(items: T[]): T[] {
  const live = items.filter(isLive);
  const real = live.filter((item) => !item.sample);
  return real.length ? real : live;
}

/** an image in src/assets/<folder>/, found by its file name */
function findImage(files: Record<string, ImageMetadata>, folder: string, file: string, forWhat: string): ImageMetadata {
  const key = Object.keys(files).find((k) => k.endsWith(`/${file}`));
  if (!key) throw new Error(`"${file}" (for "${forWhat}") is not in src/assets/${folder}/. Check the file name, including capitals.`);
  return files[key];
}

// ── art ──

const artFiles = import.meta.glob<ImageMetadata>('../assets/art/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG,WEBP}', { eager: true, import: 'default' });

/** an artwork as the gallery shows it: numbered, its shape known, its image made ready */
export type HungArtwork = Omit<Artwork, 'file' | 'ratio' | 'size'> & {
  no: string;
  ratio: number;
  size: 's' | 'm' | 'l';
  collectionName: string;
  /** `src` is sized for the wall, `full` for the viewer */
  image?: { src: string; full: string; width: number; height: number; alt: string };
};

export async function getArtworks(): Promise<HungArtwork[]> {
  const list = realOrSamples(artworks);
  return Promise.all(
    list.map(async ({ file, ...a }, i) => {
      let image: HungArtwork['image'];
      if (file) {
        const meta = findImage(artFiles, 'art', file, a.title);
        const [wall, full] = await Promise.all([
          getImage({ src: meta, width: Math.min(meta.width, 1100) }),
          getImage({ src: meta, width: Math.min(meta.width, 2400) }),
        ]);
        image = { src: wall.src, full: full.src, width: meta.width, height: meta.height, alt: a.alt ?? a.title };
      }
      return {
        ...a,
        no: two(i + 1),
        ratio: image ? image.width / image.height : (a.ratio ?? 1),
        size: a.size ?? 'm',
        collectionName: collections.find((c) => c.id === a.collection)?.name ?? a.collection,
        image,
      };
    }),
  );
}

/** the collections that have something hanging in them, with a count */
export async function getArtCollections(): Promise<(Collection & { count: number })[]> {
  const hung = await getArtworks();
  return collections.map((c) => ({ ...c, count: hung.filter((a) => a.collection === c.id).length })).filter((c) => c.count > 0);
}

// ── writing ──

type WritingEntry = CollectionEntry<'writing'>;

/** the opening of a piece, as plain text: a few lines of a poem, a sentence or two of prose */
function openingOf(body: string, kind: WritingKind): string {
  const plain = body
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '');
  if (kind === 'poem') {
    return plain
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join('\n');
  }
  const first = plain.split(/\n\s*\n/).map((para) => para.replace(/\s+/g, ' ').trim()).find(Boolean) ?? '';
  const words = first.split(' ');
  return words.length > 42 ? `${words.slice(0, 42).join(' ')}…` : first;
}

function metaOf(entry: WritingEntry): WritingMeta {
  const body = entry.body ?? '';
  const words = body.split(/\s+/).filter((w) => /\w/.test(w)).length;
  return {
    slug: entry.id,
    status: entry.data.status,
    sample: entry.data.sample || undefined,
    title: entry.data.title,
    kind: entry.data.kind,
    date: entry.data.date?.toISOString().slice(0, 10),
    dek: entry.data.dek,
    excerpt: entry.data.excerpt ?? openingOf(body, entry.data.kind),
    words,
    // poems are read slowly; prose at an ordinary pace
    minutes: Math.max(1, Math.round(words / (entry.data.kind === 'poem' ? 90 : 220))),
  };
}

/** every piece with its entry (for rendering), newest first; undated pieces keep file order */
export async function getWritingEntries(): Promise<{ meta: WritingMeta; entry: WritingEntry }[]> {
  const all = (await getCollection('writing')).map((entry) => ({ meta: metaOf(entry), entry }));
  const shown = realOrSamples(all.map((x) => ({ ...x, sample: x.meta.sample, status: x.meta.status })));
  return shown
    .map(({ meta, entry }) => ({ meta, entry }))
    .sort((a, b) => (b.meta.date ?? '').localeCompare(a.meta.date ?? '') || a.meta.slug.localeCompare(b.meta.slug));
}

export async function getWriting(): Promise<WritingMeta[]> {
  return (await getWritingEntries()).map((x) => x.meta);
}

// ── films & television ──

const posterFiles = import.meta.glob<ImageMetadata>('../assets/films/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG,WEBP}', { eager: true, import: 'default' });

export type ShownScreening = Omit<Screening, 'file'> & {
  no: string;
  shelfNames: string[];
  poster?: { src: string; width?: number; height?: number; alt: string; kind: 'poster' | 'titlecard' };
  /** the tied set (a shelf with `tied: true`) this title belongs to, and its place in it */
  set?: { id: string; name: string; at: number; of: number };
};

export async function getScreenings(): Promise<ShownScreening[]> {
  const list = realOrSamples(screenings);
  return Promise.all(
    list.map(async ({ file, image, art, ...f }, i) => {
      let poster: ShownScreening['poster'];
      const kind = art ?? 'poster';
      const alt = f.alt ?? (kind === 'poster' ? `Poster for ${f.title}` : `Title card for ${f.title}`);
      if (file) {
        const meta = findImage(posterFiles, 'films', file, f.title);
        const sized = await getImage({ src: meta, width: Math.min(meta.width, 900) });
        poster = { src: sized.src, width: meta.width, height: meta.height, alt, kind };
      } else if (image) {
        poster = { src: image, alt, kind };
      }
      const tied = shelves.find((s) => s.tied && f.shelves.includes(s.id));
      const members = tied ? list.filter((x) => x.shelves.includes(tied.id)) : [];
      return {
        ...f,
        no: two(i + 1),
        shelfNames: f.shelves.map((id) => shelves.find((s) => s.id === id)?.name ?? id),
        poster,
        set: tied ? { id: tied.id, name: tied.name, at: members.findIndex((x) => x.id === f.id) + 1, of: members.length } : undefined,
      };
    }),
  );
}

/** the shelves that have something on them, with a count */
export async function getShelves(): Promise<(Shelf & { count: number })[]> {
  const shown = await getScreenings();
  return shelves.map((s) => ({ ...s, count: shown.filter((f) => f.shelves.includes(s.id)).length })).filter((s) => s.count > 0);
}

// ── the doors ──

/** the one-line stock count each room shows on its door */
export async function roomNotes(): Promise<Record<RoomId, string>> {
  const [art, writing, films] = await Promise.all([getArtworks(), getWriting(), getScreenings()]);
  const sampled = (items: { sample?: boolean }[], word: string) => (items.some((x) => x.sample) ? `${word} · samples for now` : word);
  return {
    lab: plural(1, 'experiment'),
    art: sampled(art, plural(art.length, 'frame')),
    writing: sampled(writing, plural(writing.length, 'piece')),
    records: plural(playlist.tracks.length, 'track'),
    films: sampled(films, plural(films.length, 'title')),
  };
}
