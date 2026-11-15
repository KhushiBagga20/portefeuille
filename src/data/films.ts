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
//          image: 'https://…',            // or artwork hosted elsewhere (see `wiki` below)
//          art: 'poster',                 // 'poster' (portrait) or 'titlecard' (wide, shown whole)
//          note: 'Why this one matters to me.',                 // optional, hidden while empty
//          line: 'One sentence of yours, shown large.',          // optional
//          thoughts: ['A paragraph of what you think.', 'Another, if you have one.'],   // optional
//          shelves: ['comfort'],          // ids from `shelves`
//        },
//   The order of the list is the order of the frames on the strip.
//   An entry with no poster gets a typographic one drawn from its title.
//
// `shelves` are the ways the archive can be cut: by mood, by genre, or by what a title
// means to you. Rename, add and remove them freely; `by` only changes the small label.
//
// ARTWORK. Every image below is the one shown on that exact title's own Wikipedia article,
// so each is matched to its title rather than to something similarly named. The eleven
// films use their theatrical posters. Six series have no poster there, only an official
// title card; those are marked `art: 'titlecard'` and are shown whole on a 2:3 card.
// To swap in a better image, save it in src/assets/films/ and use `file:` instead.
// Nothing here states an opinion: `note`, `line` and `thoughts` are yours to fill in.
// ─────────────────────────────────────────────
import type { Screening, Shelf } from '../lib/types';

export const shelves: Shelf[] = [
  {
    id: 'maximoff',
    name: 'The Maximoff Trilogy',
    by: 'collection',
    tied: true,
    line: 'My own grouping of three separate titles.',
  },
];

const wiki = (path: string) => `https://upload.wikimedia.org/wikipedia/${path}`;
const SOURCE = 'Wikipedia';

type Entry = Omit<Screening, 'status' | 'shelves' | 'artSource'> & { shelves?: string[] };
const entry = ({ shelves = [], ...e }: Entry): Screening => ({ status: 'published', artSource: e.image ? SOURCE : undefined, shelves, ...e });

export const screenings: Screening[] = [
  entry({
    id: 'the-amazing-digital-circus',
    title: 'The Amazing Digital Circus',
    year: 2023,
    type: 'series',
    image: wiki('en/8/84/Amazing_Digital_Circus_logo.png'),
    art: 'titlecard',
  }),
  entry({
    id: 'fleabag',
    title: 'Fleabag',
    year: 2016,
    type: 'series',
    image: wiki('commons/0/08/Fleabag_titlecard.png'),
    art: 'titlecard',
  }),
  entry({
    id: 'project-hail-mary',
    title: 'Project Hail Mary',
    year: 2026,
    type: 'film',
    // the 2026 film's theatrical poster, from the film's own article (not the novel's cover)
    image: wiki('en/3/3b/Project_Hail_Mary_poster.jpg'),
    alt: 'Theatrical poster for the film Project Hail Mary',
  }),
  entry({ id: 'lady-bird', title: 'Lady Bird', year: 2017, type: 'film', image: wiki('en/6/61/Lady_Bird_poster.jpeg') }),
  entry({ id: 'dead-poets-society', title: 'Dead Poets Society', year: 1989, type: 'film', image: wiki('en/8/86/Dead_poets_society.png') }),
  entry({
    id: 'the-end-of-the-f-ing-world',
    title: 'The End of the F***ing World',
    year: 2017,
    type: 'series',
    image: wiki('commons/e/e9/The_End_of_the_F%2A%2A%2Aing_World_logo.png'),
    art: 'titlecard',
  }),
  entry({ id: 'inception', title: 'Inception', year: 2010, type: 'film', image: wiki('en/2/2e/Inception_%282010%29_theatrical_poster.jpg') }),
  entry({
    id: 'how-to-lose-a-guy-in-10-days',
    title: 'How to Lose a Guy in 10 Days',
    year: 2003,
    type: 'film',
    image: wiki('en/0/07/HowToLoseAGuyimp.jpg'),
  }),
  entry({
    id: '10-things-i-hate-about-you',
    title: '10 Things I Hate About You',
    year: 1999,
    type: 'film',
    image: wiki('en/9/95/10_Things_I_Hate_About_You_film.jpg'),
  }),
  entry({ id: 'uptown-girls', title: 'Uptown Girls', year: 2003, type: 'film', image: wiki('en/c/c3/Uptown_Girls.jpg') }),
  entry({ id: 'easy-a', title: 'Easy A', year: 2010, type: 'film', image: wiki('en/5/5c/Easy_A_poster.jpg') }),
  entry({ id: 'the-prestige', title: 'The Prestige', year: 2006, type: 'film', image: wiki('en/d/d2/Prestige_poster.jpg') }),
  entry({ id: 'we-live-in-time', title: 'We Live in Time', year: 2024, type: 'film', image: wiki('en/3/32/We_live_in_time_poster.jpg') }),
  entry({ id: 'good-will-hunting', title: 'Good Will Hunting', year: 1997, type: 'film', image: wiki('en/5/52/Good_Will_Hunting.png') }),

  // ── The Maximoff Trilogy: three separate titles, kept side by side ──
  entry({
    id: 'wandavision',
    title: 'WandaVision',
    year: 2021,
    type: 'series',
    image: wiki('en/2/20/WandaVision_logo.png'),
    art: 'titlecard',
    shelves: ['maximoff'],
  }),
  entry({
    id: 'agatha-all-along',
    title: 'Agatha All Along',
    year: 2024,
    type: 'series',
    image: wiki('en/7/70/Agatha_All_Along_logo.jpg'),
    art: 'titlecard',
    shelves: ['maximoff'],
  }),
  entry({
    id: 'visionquest',
    title: 'VisionQuest',
    year: 2026,
    type: 'series',
    image: wiki('en/d/d5/VisionQuest_logo.jpg'),
    art: 'titlecard',
    shelves: ['maximoff'],
  }),
];
