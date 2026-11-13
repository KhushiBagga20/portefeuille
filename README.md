# Khushi Bagga — portfolio

Astro + TypeScript. No UI framework, no animation library, no 3D library: everything that
moves is SVG, CSS and a few small scripts.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
```

## The idea: controlled chaos

The site is a run of posters. Each section has one ground, one loud colour, one large
gesture and its own way of being touched. What holds them together is strict: one typeface,
one colour scheme, one hairline, one button, one index number in the corner of every sheet.

**One typeface, four cuts.** Everything is Archivo (variable: width 62–125, weight 100–900).

| Cut | Job |
| --- | --- |
| condensed black | structure — titles, names, numbers |
| light | the quieter voice: asides, standfirsts |
| wide small capitals | annotation — indices, metadata, instructions |
| regular | reading |

**One colour scheme.**

| | |
| --- | --- |
| ink `#0c0d21` + paper `#f3f3ef` | every sheet starts here |
| cobalt `#2238ff` + marigold `#ffae00` | the pair. Blue is structure; orange-yellow is the flower |
| magenta `#ff2a85` | the spark, for one room only (milestones) |

Acid green belongs to the cube room and nowhere else. Violet survives on a couple of objects
(a disk, a sticker) and is never a ground. Project disks keep their own colours.

**Schemes.** A section picks a scheme class and builds only from that scheme's variables
(`--bg`, `--fg`, `--fg-2`, `--line`, `--accent`, `--on-accent`):

| Class | Ground | Used by |
| --- | --- | --- |
| `s-paper`, `s-paper-2` | off-white (follows day/night) | cover, about, projects, experience |
| `s-ink` | blue-black | cube, skills, records, 404 |
| `s-cobalt` | cobalt | keyboard, résumé |
| `s-magenta` | magenta | milestones |
| `s-marigold` | marigold | contact |

All of it is in `src/styles/global.css`. Physical objects (index cards, the résumé sheet,
the ID, the keyboard, the deck, the computer) keep their own colours on any ground.

**The marigold** is drawn as geometry: `Rosette.astro` makes rings of circles round a centre.
It is the mark in the nav (`Seal.astro`), the favicon, the flower turning behind the portrait
on the cover, the one you can spin in About, and the room-sized one behind the last poster.

## Running order

`src/data/chapters.ts` is the list of sections. A section's index — (03), (07) — is its
position in that list, so adding or reordering one renumbers the whole site. Keep
`src/pages/index.astro` in the same order.

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

## 2. The cube

A real 3×3: 26 cubies, each with its own orientation matrix, drawn as depth-sorted SVG
polygons (`scripts/rubik.ts`). It sits in an ink room in front of an acid disc.

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

- a cobalt room that arrives on the slant, cutting across the foot of the cube room;
- a wall of type behind the board that repeats whatever you press;
- a new dark **R** key for the résumé.

Coloured keys jump to sections — click, tap, or type the letter. Spell `hello` for the
garden. Which letters do what lives in `src/data/keyboard.ts`.

## 4. Content

Everything a visitor reads comes from data files:

| Content | File |
| --- | --- |
| Projects, the archive, disk colours | `src/data/projects.ts` |
| Milestones | `src/data/achievements.ts` |
| About, education, clubs, skill groups | `src/data/profile.ts` |
| The résumé | `src/data/resume.ts` |
| Cover words, nav, contact links | `src/data/site.ts` |

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

**A project's own page** (`/projects/<slug>/`) is a poster and a spec sheet: a cover in the
disk's colour with the name as wide as the page; the stack running past as a ticker; tiles
with the numbers the data can honestly give (features working, technologies, sections
written); then the write-up, with a contents rail that follows you. Feature groups are a
counted grid, results are set large, and sections that aren't written yet are gathered into
one list rather than shown as empty boxes. Where the browser supports it, the disk flies
here from the index.

## 5. The résumé

One sheet, three reading lengths, four lenses — at `#resume`, and on the **R** key.

- **Skim / read / everything** fold lines in and out. Reading times are counted from the
  words each length actually shows.
- A **lens** (AI, native & systems, web, design) keeps the sheet whole but lets entries that
  aren't about that subject fall back.
- It is plain CSS: the controls are radio buttons and the sheet responds with `:has()`.

`src/data/resume.ts` holds the PDF's own wording. When the PDF changes, change that file.
Phone number and home town are deliberately left out of the page; they stay in the PDF.

## 6. The record room

The deck and its state machine are unchanged (`Turntable.astro`, `scripts/turntable.ts`):
pick a sleeve, the record flies to the platter, Spotify's own player streams it, and the
platter follows what the player reports. New around it:

- **The crate** holds six sleeves. *Dig deeper* turns them over to the next six and works
  round the whole collection in order.
- **The index** — all the tracks, searchable, with running times. Click a row to play it.
- **Artists** — every artist, sized by how many of their songs are in the playlist; pick one
  to filter the index.
- A very large record on the wall that wears the current sleeve and turns while it plays.

Albums and moods are not offered because the playlist data doesn't contain them.

```bash
npm run playlist        # re-reads the public playlist into src/data/playlist.json
```

`scripts/fetch-playlist.mjs` reads two public Spotify endpoints (the embed page for the
track list, oEmbed for cover art). No account or key. Covers are hotlinked, no audio is
stored. Change the playlist with `PLAYLIST_ID=… npm run playlist`. If Spotify changes their
embed page the script may fail; the site keeps working on the last committed JSON.

## 7. The rest

- **Contact** — a marigold dome rises over the record room, with the flower turning in it;
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
| Tokens, schemes, type roles, buttons | `src/styles/global.css` |
| Layout shell, fonts, jump card | `src/layouts/Base.astro` |
| Shared motion | `src/scripts/fx.ts` |
| Nav, day/night, sound | `Nav`, `ThemeToggle`, `SoundToggle` |
| Poster strip, arrow, tags | `PosterHead`, `Arrow`, `Badge`, `ComingSoon` |
| Marigold | `Rosette`, `Seal`, `scripts/spin.ts`, `public/favicon.svg` |
| Cover | `Hero`, `Collage`, `scripts/hero.ts`, `data/collage.ts` |
| Cube | `Rubik`, `scripts/rubik.ts` |
| Keyboard | `Keyboard`, `KeyboardScene`, `Garden`, `scripts/keyboard.ts`, `scripts/iso.ts`, `data/keyboard.ts` |
| Sections | `About`, `Projects`, `Milestones`, `Communities`, `Skills`, `Resume`, `Contact` |
| A project's page | `src/pages/projects/[slug].astro` |
| Record room | `MusicRoom`, `Turntable`, `Sleeve`, `scripts/turntable.ts`, `data/music.ts` |
| Objects | `FloppyDisk`, `Computer` |
| Click sounds | `scripts/sound.ts` |

(Components are in `src/components/`.)

## Waiting on real material

Nothing below is built with stand-ins, on purpose.

- [ ] **Your photo and drawing** for the cover — the collage still runs on placeholder art.
- [ ] **Project details** marked `todo` in `src/data/projects.ts`: roles, features, stacks,
      links, screenshots, results.
- [ ] **Art** — needs your actual artwork files (and any notes you want beside them).
- [ ] **Films & shows** — needs your actual list.
- [ ] **Albums / moods in the record room** — albums need the playlist script extended;
      moods need you to say which songs are which.
- [ ] A domain, then `site` in `astro.config.mjs`.
