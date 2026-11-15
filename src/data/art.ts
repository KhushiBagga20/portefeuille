// ─────────────────────────────────────────────
// The art gallery (/playground/art/).
//
// HOW TO ADD A PIECE
//   1. Put the image in src/assets/art/
//   2. Add an entry to `artworks` below:
//        {
//          id: 'night-market',            // used in the link to the piece; letters and dashes
//          status: 'published',           // or 'draft' to keep it off the built site
//          title: 'Night market',
//          file: 'night-market.jpg',      // the file in src/assets/art/
//          alt: 'What the picture shows, for someone who cannot see it',
//          date: '2025',                  // as precise as you like: '2025', '2025-03'
//          medium: 'Ink and digital colour',
//          collection: 'sketchbook',      // an id from `collections`
//          description: 'What it is.',
//          note: 'Anything personal you want to say about it.',   // optional
//          size: 'l',                     // how large it hangs: 's', 'm' or 'l'
//        },
//   The order of the list is the order along the wall.
//
// The entries marked `sample: true` are stand-ins that ship with the site so the room
// isn't empty. They are labelled as samples everywhere they appear, and they disappear
// by themselves as soon as there is one real piece in the list.
// ─────────────────────────────────────────────
import type { Artwork, Collection } from '../lib/types';

export const collections: Collection[] = [
  { id: 'collection-a', name: 'Collection A', line: 'A sample collection. Rename or replace it in src/data/art.ts.' },
  { id: 'collection-b', name: 'Collection B', line: 'A sample collection. Rename or replace it in src/data/art.ts.' },
  { id: 'collection-c', name: 'Collection C', line: 'A sample collection. Rename or replace it in src/data/art.ts.' },
];

const SAMPLE = {
  status: 'published',
  sample: true,
  medium: 'Medium goes here',
  description: 'This is a sample frame, not a real piece. A short description goes here: what it is, and what it was made with.',
  note: 'And here, if you want one, a personal note: why you made it, or what it reminds you of.',
} as const;

const sample = (n: number, ratio: number, size: Artwork['size'], collection: string): Artwork => ({
  ...SAMPLE,
  id: `sample-${String(n).padStart(2, '0')}`,
  title: `Untitled (sample ${String(n).padStart(2, '0')})`,
  ratio,
  size,
  collection,
});

export const artworks: Artwork[] = [
  sample(1, 4 / 5, 'l', 'collection-a'),
  sample(2, 1, 'm', 'collection-b'),
  sample(3, 3 / 2, 's', 'collection-a'),
  sample(4, 2 / 3, 'm', 'collection-c'),
  sample(5, 4 / 3, 'l', 'collection-b'),
  sample(6, 1, 's', 'collection-c'),
  sample(7, 3 / 4, 'm', 'collection-a'),
  sample(8, 16 / 9, 's', 'collection-b'),
  sample(9, 4 / 5, 'l', 'collection-c'),
];
