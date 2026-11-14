// ─────────────────────────────────────────────
// The film & television archive (/playground/films/).
//
// HOW TO ADD A FILM OR A SHOW
//   Add an entry to `screenings` below:
//        {
//          id: 'spirited-away',           // used in the link to the entry; letters and dashes
//          status: 'published',           // or 'draft' to keep it off the built site
//          title: 'Spirited Away',
//          year: 2001,
//          type: 'film',                  // or 'series'
//          by: 'Hayao Miyazaki',          // optional: director or creator
//          file: 'spirited-away.jpg',     // optional: a poster in src/assets/films/
//          alt: 'What the poster shows',
//          line: 'One sentence of yours, shown large.',
//          thoughts: ['A paragraph of what you think.', 'Another, if you have one.'],
//          shelves: ['comfort'],          // ids from `shelves`
//        },
//   The order of the list is the order of the frames on the strip.
//   An entry with no poster gets a typographic one drawn from its title.
//
// `shelves` are the ways the archive can be cut: by mood, by genre, or by what a title
// means to you. Rename, add and remove them freely; `by` only changes the small label.
//
// The entries marked `sample: true` are stand-ins. They name no real film and claim no
// opinion; they are labelled as samples everywhere, and they disappear by themselves as
// soon as there is one real entry in the list.
// ─────────────────────────────────────────────
import type { Screening, Shelf } from '../lib/types';

export const shelves: Shelf[] = [
  { id: 'shelf-a', name: 'Shelf A', by: 'mood', line: 'A sample shelf, grouped by mood. Rename it in src/data/films.ts.' },
  { id: 'shelf-b', name: 'Shelf B', by: 'genre', line: 'A sample shelf, grouped by genre. Rename it in src/data/films.ts.' },
  { id: 'shelf-c', name: 'Shelf C', by: 'significance', line: 'A sample shelf, for titles that matter for a reason of their own.' },
];

const sample = (n: number, type: Screening['type'], on: string[]): Screening => {
  const no = String(n).padStart(2, '0');
  return {
    id: `sample-${no}`,
    status: 'published',
    sample: true,
    title: `Sample title ${no}`,
    type,
    line: 'One line about it goes here, set large.',
    thoughts: [
      'This is a sample entry. It names no real film or show, and it is not one of my picks.',
      'Your own thoughts go here: why it stayed with you, when you first watched it, what you would tell a friend before they pressed play.',
    ],
    shelves: on,
  };
};

export const screenings: Screening[] = [
  sample(1, 'film', ['shelf-a']),
  sample(2, 'series', ['shelf-b']),
  sample(3, 'film', ['shelf-a', 'shelf-c']),
  sample(4, 'film', ['shelf-b']),
  sample(5, 'series', ['shelf-c']),
  sample(6, 'film', ['shelf-a', 'shelf-b']),
  sample(7, 'series', ['shelf-a']),
  sample(8, 'film', ['shelf-c']),
];
