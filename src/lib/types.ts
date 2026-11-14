// ─────────────────────────────────────────────
// The content model.
//
// Every record the site shows is one of the shapes in this file. They are deliberately
// plain data — strings, numbers, arrays, nothing else — so the same record can come from a
// local file today (src/data, src/content) and from an API response later, unchanged.
//
// Two rules run through all of them:
//   1. A field that isn't known yet is LEFT OUT. The site shows what exists and lists what
//      is still to come; it never fills a gap with a guess.
//   2. `status: 'draft'` keeps a record off the built site (it still shows in `npm run dev`).
// ─────────────────────────────────────────────

/** published records are on the site; drafts only show while developing */
export type Status = 'draft' | 'published';

/** how far along a piece of work is. Used by features, milestones, diagram parts. */
export type Stage = 'done' | 'ongoing' | 'planned';

export interface Link {
  label: string;
  href: string;
}

/** a screenshot, a diagram export, a short screen recording */
export interface Media {
  kind: 'image' | 'video';
  /** a file in /public (e.g. "/projects/conduit/mirror.png") or a full URL */
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

// ─────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────

export type Label =
  | 'Hackathon'
  | 'Recognition'
  | 'Ongoing'
  | 'AI'
  | 'Social impact'
  | 'Product design'
  | 'Native software'
  | 'Personal project'
  | 'Workshop';

export type DiskTone = 'tomato' | 'pink' | 'lilac' | 'lemon' | 'sky' | 'mint';

/** The card-level facts about a project: what the index, the disks and the skills graph use. */
export interface Project {
  slug: string;
  status?: Status;
  name: string;
  earlierName?: string;
  /** project type / status (the event is added after it automatically) */
  type: string;
  oneLiner?: string;
  /** short teaser for the card */
  preview?: string;
  labels: Label[];
  event?: string;
  /** confirmed results only */
  outcome?: string[];
  /** confirmed contribution only */
  role?: string;
  /** confirmed technologies only */
  stack?: string[];
  disk: { tone: DiskTone; scribble: string };
  links: { github?: string; demo?: string };
  /** notes to self about what is still missing. Never shown on the site. */
  todo?: string[];
}

export interface ArchiveItem {
  name: string;
  type: string;
  labels: Label[];
  description?: string;
  points?: string[];
  stack?: string[];
  links: { github?: string; demo?: string };
  todo?: string[];
}

// ─────────────────────────────────────────────
// Case studies
//
// One per project, keyed by the project's slug. A case study is a fixed run of sections
// (see `caseSections` below); each section appears on the page only when it has content.
// ─────────────────────────────────────────────

export interface CaseStudy {
  slug: string;
  status: Status;
  /** ISO date of the last real edit. Shown on the page when present. */
  updated?: string;

  /** A · the introduction */
  intro: {
    /** the problem, as paragraphs */
    problem?: string[];
    /** what was built and why, as paragraphs */
    built?: string[];
    /** the 60-second version: the handful of things worth knowing */
    highlights?: string[];
    /** screenshots and demos */
    media?: Media[];
  };

  /** what it does, in groups */
  features?: FeatureGroup[];

  /** B · architecture diagrams */
  diagrams?: Diagram[];

  /** C · how the project took shape. Each branch is a list of nodes; leave a branch out
   *  and the map marks it "not written yet". `implementation` falls back to `features`. */
  mindmap?: Partial<Record<MindBranch, MindNode[]>>;

  /** D · milestones, in order */
  timeline?: Milestone[];
  /** dated progress notes. They are merged into the timeline; this is the list a backend
   *  will append to. */
  updates?: Update[];

  /** E · technical deep dives */
  deepDives?: DeepDive[];

  /** F · reflection */
  reflection?: Reflection;
}

export interface FeatureGroup {
  title: string;
  stage?: Stage;
  /** a caveat shown with the group, e.g. "designed, not all live yet" */
  note?: string;
  items: string[];
}

// ── B · diagrams ─────────────────────────────

export interface Diagram {
  id: string;
  title: string;
  caption?: string;
  /** what the drawing is based on: what is built, or what is designed */
  basis: 'built' | 'designed';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export type DiagramNodeKind = 'device' | 'app' | 'service' | 'link' | 'channel' | 'store' | 'person' | 'step' | 'outcome';

export interface DiagramNode {
  id: string;
  label: string;
  kind: DiagramNodeKind;
  /** where it sits on the drawing's grid: column and row, from 0. Fractions are fine. */
  col: number;
  row: number;
  /** height in rows, for a part that many things connect to (default 1) */
  rows?: number;
  /** one line for the detail panel */
  summary?: string;
  /** what is known about it, as short points */
  details?: string[];
  tech?: string[];
  stage?: Stage;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  /** which way data moves: from → to, to → from, or both */
  flow: 'forward' | 'back' | 'both';
  stage?: Stage;
}

// ── C · mind map ─────────────────────────────

export const mindBranches = ['idea', 'research', 'challenges', 'decisions', 'implementation', 'future'] as const;
export type MindBranch = (typeof mindBranches)[number];

export interface MindNode {
  label: string;
  /** a sentence shown when the node is opened */
  note?: string;
  stage?: Stage;
  children?: MindNode[];
}

// ── D · timeline ─────────────────────────────

export interface Milestone {
  title: string;
  stage: Stage;
  /** as precise as is actually known: "2025", "2025-03", "2025-03-14". Leave out if unknown. */
  date?: string;
  kind?: 'milestone' | 'achievement' | 'challenge' | 'recognition';
  body?: string;
  items?: string[];
  media?: Media[];
}

export interface Update {
  /** ISO date */
  date: string;
  title: string;
  body?: string;
  stage?: Stage;
  media?: Media[];
}

// ── E · deep dives ───────────────────────────

export interface DeepDive {
  title: string;
  kind?: 'algorithm' | 'protocol' | 'architecture' | 'tradeoff' | 'debugging';
  /** one line under the title */
  summary?: string;
  /** the explanation, as paragraphs. Without it the topic is listed as "notes to come". */
  body?: string[];
  /** the decision record, when there is one */
  chose?: string;
  because?: string;
  tradeoff?: string;
  code?: { lang: string; source: string; caption?: string };
}

// ── F · reflection ───────────────────────────

export interface Reflection {
  worked?: string[];
  didnt?: string[];
  learned?: string[];
  improve?: string[];
}

// ── the page's sections, in order ─────────────

/** `depth` decides who sees a section: 'brief' is the 60-second read, 'deep' the full study. */
export const caseSections = [
  { id: 'brief', label: 'In 60 seconds', depth: 'brief' },
  { id: 'features', label: 'What it does', depth: 'brief' },
  { id: 'architecture', label: 'Architecture', depth: 'deep' },
  { id: 'thinking', label: 'How it took shape', depth: 'deep' },
  { id: 'timeline', label: 'Timeline', depth: 'deep' },
  { id: 'deep-dives', label: 'Deep dives', depth: 'deep' },
  { id: 'reflection', label: 'Reflection', depth: 'deep' },
] as const;

export type CaseSectionId = (typeof caseSections)[number]['id'];

// ─────────────────────────────────────────────
// The Playground's collections
// ─────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  line?: string;
}

export interface Artwork {
  id: string;
  status: Status;
  /** true for the stand-ins that ship with the site. Real work never sets this. */
  sample?: boolean;
  title: string;
  /** a file in src/assets/art/. Leave out and an empty, labelled frame hangs in its place. */
  file?: string;
  alt?: string;
  /** width ÷ height. Only needed while there is no file; with a file it is read from the image. */
  ratio?: number;
  /** "2025", "2025-03"… */
  date?: string;
  medium?: string;
  /** the id of one of the collections in src/data/art.ts */
  collection: string;
  description?: string;
  /** a personal note, set apart from the description */
  note?: string;
  /** how large it hangs on the wall */
  size?: 's' | 'm' | 'l';
}

export type WritingKind = 'poem' | 'essay' | 'fiction';

export interface WritingMeta {
  slug: string;
  status: Status;
  sample?: boolean;
  title: string;
  kind: WritingKind;
  /** ISO date */
  date?: string;
  /** a line under the title */
  dek?: string;
  /** the opening lines, shown in the archive. Worked out from the text when left out. */
  excerpt: string;
  words: number;
  minutes: number;
}

export interface Screening {
  id: string;
  status: Status;
  sample?: boolean;
  title: string;
  year?: number;
  type: 'film' | 'series';
  /** a poster in src/assets/films/. Leave out and a typographic stand-in is drawn. */
  file?: string;
  alt?: string;
  /** who made it — director or creator — if you want it shown */
  by?: string;
  /** personal commentary, as paragraphs */
  thoughts?: string[];
  /** one line, shown large */
  line?: string;
  /** ids of the shelves (src/data/films.ts) it sits on */
  shelves: string[];
}

export interface Shelf extends Collection {
  /** what kind of grouping it is */
  by: 'mood' | 'genre' | 'significance';
}
