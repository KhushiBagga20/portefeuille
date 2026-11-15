// ─────────────────────────────────────────────
// The square-hole collage
//
// SWAP IN YOUR OWN ART:
//   1. Put your photo at        src/assets/collage/photo.jpg
//   2. Put your drawing at      src/assets/collage/illustration.png
//      (same canvas size as the photo, 1600 × 2000, lined up so the face sits in the same place)
//   3. Nudge the holes below so they sit over your eyes, hands, etc.
//
// Coordinates use an 800 × 1000 grid (4:5), whatever your image resolution is.
// (cx, cy) = centre of the square, s = side length.
// ─────────────────────────────────────────────
import photo from '../assets/collage/photo.jpg';
import illustration from '../assets/collage/illustration.png';

export type Hole = { cx: number; cy: number; s: number };

export const collage = {
  photo: {
    src: photo,
    alt: 'Khushi taking a mirror photo, smiling and looking to one side',
    file: 'khushi_real.jpg',
  },
  illustration: {
    src: illustration,
    alt: 'A pencil sketch of Khushi, drawn from the same photo',
    file: 'khushi_drawn.png',
  },

  // Colour of the paper the drawing sits on (shows behind a transparent PNG).
  sheet: '#86b4f7',

  // Act 1: holes cut into the drawing. You see the photo through them.
  photoWindows: [
    { cx: 378, cy: 248, s: 150 }, // eyes
    { cx: 676, cy: 170, s: 118 }, // phone cameras
    { cx: 400, cy: 770, s: 172 }, // folded arm + bracelet
    { cx: 228, cy: 640, s: 108 }, // arm
  ] satisfies Hole[],

  // Act 3: the photo has taken over, and new windows show the drawing.
  drawingWindows: [
    { cx: 400, cy: 335, s: 142 }, // smile + earrings
    { cx: 300, cy: 140, s: 112 }, // hair
    { cx: 330, cy: 630, s: 160 }, // embroidered leaves
    { cx: 690, cy: 480, s: 118 }, // wrist + thread bracelet
  ] satisfies Hole[],

  // The square that follows your cursor on desktop.
  lensSize: 136,
};
