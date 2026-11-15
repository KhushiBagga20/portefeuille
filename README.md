# Khushi Bagga — portfolio

Astro + TypeScript. No UI framework, no animation library, no 3D library: everything that
moves is SVG, CSS and a few small scripts.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
```

## Two halves

The site is two experiences that share one design.

| | Where | What it is |
| --- | --- | --- |
| **The portfolio** — what I've built | `/` and `/projects/<slug>/` | cover, keyboard, projects, about, experience, milestones, skills, résumé, contact |
| **The Playground** — how my brain works | `/playground/…` | the lab (the cube), the art gallery, the writing room, the record room, the film archive |

The Playground has its own layout (`src/layouts/Play.astro`), its own navigation
(`PlayNav.astro`) and is dark from edge to edge. You get there from the pill in the nav,
from the keyboard on the home page (the dark keys, and the lime **Y**), or from the foot of
any room. Going in, the page rises as a dome; coming back, daylight drops in from the top
(named view transitions, set up in `Base.astro` and `global.css`).

## The idea: controlled chaos

Each section is a poster: one ground, one loud colour, one large gesture and its own way of
being touched. What holds them together is strict: four typefaces with one job each, one
colour scheme, one hairline, one button, one index number in the corner of every sheet.

**Four typefaces, four jobs.** Components ask for a role (a token), never a family, so the
whole system can be re-cast in `src/styles/global.css`.

| Token | Face | Job |
| --- | --- | --- |
| `--font-display` | Anton | the poster voice: huge condensed headlines. One loud line per screen, not one per heading |
| `--font-head` | Archivo Black | second rank: the name, project titles, section heads, graphic statements |
| `--font-body` | Manrope | everything read or pressed: text, nav, buttons, labels |
| `--font-mono` | IBM Plex Mono | the machine's voice only: indices, dates, counts, readouts. Lower case, small, never on buttons |

The heading scale is tokens too (`--fs-poster`, `--fs-title`, `--fs-head`, `--fs-sub`,
`--fs-lede`, `--fs-read`). To try a different face, change one `--font-*` line.

**One colour scheme.**

| | |
| --- | --- |
| ink `#0c0d21` + paper `#f3f3ef` | every sheet starts here |
| cobalt `#2238ff` + marigold `#ffae00` | the pair. Blue is structure; orange-yellow is the flower |
| magenta `#ff2a85` | the spark, for one room only (milestones) |

Acid green is the Playground's light (it began in the cube room) and never appears as a
ground on the portfolio. Each room has one accent of its own, also a token: `--room-lab`,
`--room-art`, `--room-writing`, `--room-records`, `--room-films`. Violet survives on a couple
of objects and is never a ground. Project disks keep their own colours.

The palette is not final. Every colour a component uses comes from a token in `:root`, so a
new palette is a change to that one block.

**Schemes.** A section picks a scheme class and builds only from that scheme's variables
(`--bg`, `--fg`, `--fg-2`, `--line`, `--accent`, `--on-accent`):

| Class | Ground | Used by |
| --- | --- | --- |
| `s-paper`, `s-paper-2` | off-white (follows day/night) | cover, about, projects, experience, case studies |
| `s-ink` | blue-black | skills, the cube, records, case-study diagrams, 404 |
| `s-play` | blue-black, lit in acid | the Playground's bar, hub and footers |
| `s-cobalt` | cobalt | keyboard, résumé |
| `s-magenta` | magenta | milestones |
| `s-marigold` | marigold | contact |

All of it is in `src/styles/global.css`. Physical objects (index cards, the résumé sheet,
the ID, the keyboard, the deck, the computer) keep their own colours on any ground.

**The marigold** is drawn as geometry: `Rosette.astro` makes rings of circles round a centre.
It is the mark in the nav (`Seal.astro`), the favicon, the flower turning behind the portrait
on the cover, the one you can spin in About, and the room-sized one behind the last poster.

## Running order

`src/data/chapters.ts` is the list of sections on the main page. A section's index — (03),
(07) — is its position in that list, so adding or reordering one renumbers the page. Keep
`src/pages/index.astro` in the same order.

The Playground's rooms are listed in `src/data/playground.ts` (number, name, address, accent,
and `open: false` to draw a room on the plan without making it a door yet).

## 1. The cover

A masthead the width of the page, the portrait standing in front of it, and the name
repeated as an outline across the portrait so it still reads. The letters swell toward the
cursor along Archivo's width axis while the others give way by the same amount, so the word
never changes length.

The portrait is the square-hole collage: your photo underneath, your drawing on top with
windows cut in it by CSS masks. While the cover is pinned, scrolling plays three acts —
**look closer**, **open up**, **swap** — and on desktop a square lens follows the cursor.
That logic (`Collage.astro`, `scripts/hero.ts`, `scripts/collage-math.ts`) is unchanged;
`Hero.astro` only decides where things sit around it.

### Swapping in your own art

1. **Photo** → replace `src/assets/collage/photo.jpg` (portrait, 4:5, e.g. 1600×2000).
2. **Drawing** → replace `src/assets/collage/illustration.png`. Draw it on top of your photo,
   on the same canvas, then export the drawing alone with a transparent background.
3. **Holes** → edit `photoWindows` and `drawingWindows` in `src/data/collage.ts` (800×1000 grid).
4. Run `npm run og` afterwards (see below) so the link preview matches.

The same drawing is used on the student ID in About.

## 2. The cube (now the Playground's lab)

A real 3×3: 26 cubies, each with its own orientation matrix, drawn as depth-sorted SVG
polygons (`scripts/rubik.ts`). It sits in an ink room in front of an acid disc, at
`/playground/lab/` — the first experiment on the bench. New experiments get their own page
or join this one.

- Drag the background to orbit; drag a sticker to turn that layer.
- The pad and a real keyboard both speak standard notation: **U D L R F B**, with ′ (or
  shift) for counter-clockwise.
- The panel reads the cube itself: moves made by hand, solved or scrambled (checked by
  looking at the faces, so it's right whichever way up the cube ends), the last turn, and
  the camera angle on a dial.
- **Scramble** is 18 turns that never undo the one before. **Solve** plays the move log
  backwards, compressed — you watch it undo itself. Press it again to skip to the end.
- A turn commits at 90° by rewriting integer positions, so nothing drifts.

## 3. The keyboard

The board, its garden and its behaviour are as they were (`KeyboardScene.astro`,
`Garden.astro`, `scripts/keyboard.ts`, `scripts/iso.ts`). Around it:

- a cobalt room that arrives on the slant, cutting across the foot of the cover.
  The board is lowered so its highest key always sits just under the header strip,
  whatever the window's shape (`Keyboard.astro` works that out from the drawing itself);
- a wall of type behind the board that repeats whatever you press.

It is the gateway to both halves of the site. **Bright keys** jump to sections of the page;
**dark keys** open rooms of the Playground (W writing, I art, L lab, V records, F films) and
the lime **Y** opens its front door. Click, tap, or type the letter. Back returns to the
keyboard. Spell `hello` for the garden. Which letters do what lives in
`src/data/keyboard.ts`.

## 4. Content

Everything a visitor reads comes from data, and every page asks for it through
`src/lib/content.ts` (the shapes are in `src/lib/types.ts`). That layer is why the backend
could be added without touching a component: set `PORTFOLIO_API_URL` and projects and case
studies come from the API; leave it blank and they come from the files below.

| Content | File |
| --- | --- |
| Projects (card-level facts), the archive, disk colours | `src/data/projects.ts` |
| Case studies, one per project | `src/data/case-studies/<slug>.ts` |
| Milestones | `src/data/achievements.ts` |
| About, education, clubs, skill groups | `src/data/profile.ts` |
| The résumé | `src/data/resume.ts` |
| Cover words, nav, contact links | `src/data/site.ts` |
| Artwork | `src/data/art.ts` + images in `src/assets/art/` |
| Writing | one Markdown file per piece in `src/content/writing/` |
| Films & television | `src/data/films.ts` + posters in `src/assets/films/` |
| The record collection | `src/data/playlist.json` (from `npm run playlist`) |

`status: 'draft'` on a project, case study, artwork, piece of writing or film keeps it off
the built site; it still shows in `npm run dev`.

House rules, unchanged:

- A field left out shows a plain **"details coming soon"**, never a guess.
- Links appear only once they're filled in.
- `todo` lists are notes to yourself and never render.

How each section shows its data:

- **About** — a modular poster: one board of cells on a hairline grid. The sentence at
  headline size, the graduation year and the grade as figures that count up, the ID card
  (leans toward the cursor, turns over), the list, and a marigold you can spin.
- **Projects** — the first project at full size, the rest as an index. A row floods with its
  disk's colour and the disk rides under the cursor.
- **Milestones** — index cards in a drawer. Tabs, arrow keys or the buttons pull a card to
  the front. A sideways row on phones; a plain list with no JS.
- **Experience** — the clubs, set like the project index: number, name, facts, flood.
- **Skills** — a patch bay. One cable per real connection between a project's stack and a
  tool; a live cable visibly carries current. Nothing is rated.

**A project's case study** (`/projects/<slug>/`) is built from one `CaseStudy` record. A
section appears only when it has content; whatever is missing is gathered into one "still to
come" list at the foot, never shown as empty boxes or filled with guesses.

| Section | Component | What it does |
| --- | --- | --- |
| Cover, stack ticker | in the page | the disk's colour, the name as wide as the page, the disk flying in from the index |
| In 60 seconds | in the page | the one-liner, the problem, what was built, a fact sheet, screenshots |
| What it does | in the page | feature groups, each marked working / being built / planned |
| Architecture | `case/Diagram.astro`, `scripts/diagram.ts` | parts on a grid with the direction data moves. Every part is a button that explains it; zoom, pan, and a list view that says the same in words |
| How it took shape | `case/MindMap.astro` | idea, research, challenges, decisions, implementation, what next. Branches open and close; an unwritten branch is drawn dashed and says so |
| Timeline | `case/Timeline.astro` | milestones and dated updates; done, in progress and planned never look alike |
| Deep dives | `case/DeepDives.astro` | folded to a line each; a topic with no notes yet is listed, not offered |
| Reflection | `case/Reflection.astro` | what worked, what didn't, what I learned, what I'd improve |

The strip under the nav lists the sections and holds the switch between **60 seconds** (the
page folds down to the cover, the brief and the features) and the **full study**.

To add a case study: copy `src/data/case-studies/conduit.ts`, change the slug, fill in what is
true, and add it to `index.ts` in the same folder. Diagram nodes are placed by column and row;
the mind map's `implementation` branch falls back to the feature groups, so a new project gets
a map for free.

## The Playground's rooms

**Art gallery** (`/playground/art/`). A lit wall inside the dark Playground. Frames are hung
salon-style by `scripts/hang.ts` on a wall longer than the window: scroll to walk it, drag a
frame to move it, pick a collection and the wall re-hangs, click a frame for the viewer (date,
medium, description, an optional personal note, a link straight to the piece). Phones, touch
screens and reduced motion get the same frames laid down the page.
*To add a piece:* put the image in `src/assets/art/` and add an entry to `src/data/art.ts`
(the file's header shows every field).

**Writing room** (`/playground/writing/`). A contents page set like a small magazine: each
title unfolds its opening lines when reached for. The reading page sets a poem exactly as
typed, an essay in spaced paragraphs, a story in indented ones; the reader can change the
page colour, the typeface and the size, and **focus** clears everything but the text.
The room has two halves, **Professional** and **Personal**; a piece picks one with `side:` (personal if left out).

*To add a piece:* create `src/content/writing/your-title.md` — the sample essay in that
folder is the instructions.

**Film & television archive** (`/playground/films/`). A screening room: one title on the
screen with its poster and what I think of it, and a strip of film underneath with a frame
per title. Click a frame, use the arrow keys or the stepper and the screen cuts to it.
Shelves re-cut the reel by mood, genre, significance or kind.
Clicking the poster on the screen (or the frame that is already showing) opens a detail
view with the artwork larger, the title and its format; arrows move through the reel and
Escape closes it. A shelf marked `tied` (The Maximoff Trilogy) keeps its titles side by side
under one bar on the strip.
*To add a title:* add an entry to `src/data/films.ts`. Artwork is either `file:` (an image in
`src/assets/films/`) or `image:` (an address elsewhere); `art: 'titlecard'` shows a wide title
card whole on a 2:3 card. Every title also has a poster drawn from type underneath, which is
what shows with no artwork or if an image fails to load. `note` is for why a title matters to
you and stays hidden while empty.

**Samples.** Each of those three rooms ships with clearly labelled stand-ins so it isn't
empty. They name nothing real and claim no opinion, and they disappear by themselves as soon
as the room has one real entry — nothing needs deleting.

## 5. The résumé

One sheet, three reading lengths, four lenses — at `#resume`, and on the **R** key.

- **Skim / read / everything** fold lines in and out. Reading times are counted from the
  words each length actually shows.
- A **lens** (AI, native & systems, web, design) keeps the sheet whole but lets entries that
  aren't about that subject fall back.
- It is plain CSS: the controls are radio buttons and the sheet responds with `:has()`.

`src/data/resume.ts` holds the PDF's own wording. When the PDF changes, change that file.
Phone number and home town are deliberately left out of the page; they stay in the PDF.

## 6. The record room (`/playground/music/`)

The deck and its state machine are unchanged (`Turntable.astro`, `scripts/turntable.ts`):
pick a sleeve, the record flies to the platter, Spotify's own player streams it, and the
platter follows what the player reports. New around it:

- **The crate** holds six sleeves. *Dig deeper* turns them over to the next six and works
  round the whole collection in order.
- **Now playing** shows the sleeve, the title and artist, the track's place in the playlist
  and its running time; one record gives way to the next with a short turn.
- **The index**, three ways in:
  - *songs* — all the tracks, searchable, with running times. Click a row to play it.
  - *artists* — every artist, sized by how many of their songs are in the playlist.
  - *sleeves* — one tile per distinct cover. The playlist data has no album names, so this
    is the honest version of browsing by album.
  Picking an artist or a sleeve filters the songs.
- A large record on the wall that wears the current sleeve and turns while it plays.

Album names and moods are not offered because the playlist data doesn't contain them.

```bash
npm run playlist        # re-reads the public playlist into src/data/playlist.json
```

`scripts/fetch-playlist.mjs` reads two public Spotify endpoints (the embed page for the
track list, oEmbed for cover art). No account or key. Covers are hotlinked, no audio is
stored. Change the playlist with `PLAYLIST_ID=… npm run playlist`. If Spotify changes their
embed page the script may fail; the site keeps working on the last committed JSON.

## 7. The rest

- **Contact** — a marigold dome rises over the résumé room, with the flower turning in it;
  the address is set as large as it goes; the masthead returns across the foot of the page.
- **404** — `src/pages/404.astro`.
- **Link preview** — `public/og.png` is a screenshot of `/og/`. With the dev server running:
  `npm run og`. Once there's a domain, set `site` in `astro.config.mjs`.

## Shared motion

`src/scripts/fx.ts`, loaded once from the layout:

| Hook | What it gives the element |
| --- | --- |
| `data-reveal` | fades up once, the first time it's on screen |
| `data-view` | `--enter` and `--through`, 0→1 as it crosses the viewport |
| `data-pointer` | `--px` / `--py`, the cursor's position across it |
| `data-tilt` | `--tx` / `--ty` / `--lit`, for things that lean toward the cursor |
| `data-kinetic` + `data-k` | letters that swell toward the cursor |
| `data-chapter` | reported in the nav as "where you are" |

**Jumps.** Nav links and keyboard keys don't scroll past six sections. A card in the
destination's colours wipes across with its name sized to the screen, the page moves behind
it, the card leaves (`jumpTo`). Every jump is a real step in history, so **Back returns you
to where you jumped from** — press a key on the keyboard, go Back, and you're at the
keyboard again, not at the top.

## Day and night

The half-moon in the nav. Only the neutral paper moves; cobalt is cobalt at midnight.
Daylight is the default for everyone — night only if the visitor has chosen it.

## Accessibility

- Text contrast is measured, both themes, every page.
- Everything interactive is a real button, link or radio, and works from the keyboard.
- With `prefers-reduced-motion`: the cover isn't pinned (three buttons switch the collage),
  nothing follows the cursor or the scroll, jumps land instantly, the cube turns without
  animating, records don't spin.
- With no JavaScript every section is still complete and readable.

## Where things live

| What | File |
| --- | --- |
| Running order | `src/data/chapters.ts`, `src/pages/index.astro` |
| Content layer and content model | `src/lib/content.ts`, `src/lib/types.ts` |
| The Playground's shell, bar, rooms | `src/layouts/Play.astro`, `PlayNav`, `src/data/playground.ts`, `src/pages/playground/` |
| Tokens, schemes, type roles, buttons | `src/styles/global.css` |
| Layout shell, fonts, jump card | `src/layouts/Base.astro` |
| Shared motion | `src/scripts/fx.ts` |
| Nav, day/night, sound | `Nav`, `ThemeToggle`, `SoundToggle` |
| Poster strip, arrow, tags | `PosterHead`, `Arrow`, `Badge`, `ComingSoon` |
| Marigold | `Rosette`, `Seal`, `scripts/spin.ts`, `public/favicon.svg` |
| Cover | `Hero`, `Collage`, `scripts/hero.ts`, `data/collage.ts` |
| Cube (the lab) | `Rubik`, `scripts/rubik.ts`, `pages/playground/lab.astro` |
| Keyboard | `Keyboard`, `KeyboardScene`, `Garden`, `scripts/keyboard.ts`, `scripts/iso.ts`, `data/keyboard.ts` |
| Sections | `About`, `Projects`, `Milestones`, `Communities`, `Skills`, `Resume`, `Contact` |
| A case study | `src/pages/projects/[slug].astro`, `components/case/*`, `scripts/diagram.ts`, `data/case-studies/` |
| Art gallery | `pages/playground/art.astro`, `scripts/gallery.ts`, `scripts/hang.ts`, `data/art.ts` |
| Writing room | `pages/playground/writing/`, `scripts/reading.ts`, `src/content.config.ts`, `src/content/writing/` |
| Film archive | `pages/playground/films.astro`, `data/films.ts` |
| Record room | `MusicRoom`, `Turntable`, `Sleeve`, `scripts/turntable.ts`, `data/music.ts`, `pages/playground/music.astro` |
| Objects | `FloppyDisk`, `Computer` |
| Click sounds | `scripts/sound.ts` |

(Components are in `src/components/`.)

## Waiting on real material

The site never fills a gap with a guess. These are the gaps.

- [ ] **Your photo and drawing** for the cover — the collage still runs on placeholder art.
- [ ] **Project details** marked `todo` in `src/data/projects.ts` and listed as "still to
      come" on each case study: roles, problems, features, screenshots, links, results, and
      the write-ups behind the deep-dive topics, timelines and reflections.
- [ ] **Art** — the gallery is built and hung with sample frames. It needs your image files
      in `src/assets/art/` and their entries in `src/data/art.ts`.
- [ ] **Writing** — the room is built and holds three sample pieces. It needs your poems,
      essays and stories as `.md` files in `src/content/writing/`.
- [ ] **Films & shows** — the archive is built on a sample reel. It needs your list, your
      commentary and your shelf names in `src/data/films.ts`.
- [ ] **Albums / moods in the record room** — the playlist data has no album names, so the
      room browses by sleeve (cover art) instead; naming albums needs the playlist script
      extended, and moods need you to say which songs are which.
- [ ] A domain, then `site` in `astro.config.mjs`.


## Living portfolio / portefeuille

This project now lives at https://github.com/KhushiBagga20/portefeuille.

The FastAPI/PostgreSQL backend is in `backend/`. Start with [backend setup](backend/README.md).
Run the frontend with `npm run dev`, then visit `/studio/` for the private owner editor.
The studio requires backend owner login; private content is never bundled into static pages.

Copy `.env.example` to `.env` only when configuring the connection.
`PUBLIC_API_ORIGIN` is the browser-visible API URL (no secrets).
`PORTFOLIO_API_URL` opts the build into approved backend content. Leave it blank to keep current local content.
Do not enable it until your initial projects are published in the backend.

Publishing changes the API. Astro still needs a new build/deployment to update the hosted website.
The production backend queues a Vercel rebuild after approval; the website updates once that build succeeds.

[Frontend integration details](backend/docs/FRONTEND_HANDOFF.md) · [Architecture](backend/docs/ARCHITECTURE.md)

[Vercel deployment guide](backend/docs/VERCEL.md) — the API, GitHub owner login, Neon database and queue consumer are live. All six approved baselines are published and automatic rebuilds are verified; repository webhooks and AI credentials remain to be configured.
