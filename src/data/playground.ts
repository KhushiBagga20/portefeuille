// ─────────────────────────────────────────────
// The Playground — "how my brain works".
//
// A separate set of pages from the main portfolio, with its own navigation. Each room is
// one page under /playground/. To add a room: add it here, create its page in
// src/pages/playground/, and (if you want a key for it) add a line to src/data/keyboard.ts.
//
// `accent` is a design token from styles/global.css, so the rooms re-colour with the palette.
// ─────────────────────────────────────────────
export type RoomId = 'lab' | 'art' | 'writing' | 'records' | 'films';

export type Room = {
  id: RoomId;
  /** two-digit room number, shown on the door */
  no: string;
  /** the short name used in navigation and on its key */
  name: string;
  href: string;
  /** one honest line about what is in the room */
  line: string;
  accent: string;
  onAccent: string;
  /** false while the room is still being built: it shows on the plan but isn't a door yet */
  open: boolean;
};

export const playground = {
  href: '/playground/',
  name: 'playground',
  title: 'Playground',
  line: 'how my brain works',
  intro: 'The portfolio is what I have built. This is the rest of it: the fidgeting, the drawing, the writing, the listening and the watching.',
};

export const rooms: Room[] = [
  {
    id: 'lab',
    no: '01',
    name: 'lab',
    href: '/playground/lab/',
    line: 'Things to fidget with. First on the bench: a cube that really turns.',
    accent: 'var(--room-lab)',
    onAccent: '#0c0d21',
    open: true,
  },
  {
    id: 'art',
    no: '02',
    name: 'art',
    href: '/playground/art/',
    line: 'A wall you can rearrange. Drag the frames, open one up close.',
    accent: 'var(--room-art)',
    onAccent: '#0c0d21',
    open: true,
  },
  {
    id: 'writing',
    no: '03',
    name: 'writing',
    href: '/playground/writing/',
    line: 'Poems, essays and fiction, set to be read slowly.',
    accent: 'var(--room-writing)',
    onAccent: '#0c0d21',
    open: true,
  },
  {
    id: 'records',
    no: '04',
    name: 'records',
    href: '/playground/music/',
    line: 'A turntable that works, and the crate that goes with it.',
    accent: 'var(--room-records)',
    onAccent: '#0c0d21',
    open: true,
  },
  {
    id: 'films',
    no: '05',
    name: 'films',
    href: '/playground/films/',
    line: 'A filmstrip of the films and shows I keep.',
    accent: 'var(--room-films)',
    onAccent: '#0c0d21',
    open: true,
  },
];

/** the rooms a visitor can actually walk into today */
export const openRooms = rooms.filter((r) => r.open);

export const room = (id: RoomId) => rooms.find((r) => r.id === id)!;
