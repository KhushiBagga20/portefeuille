// Hanging pictures on a wall.
//
// Given the pieces in order (each with a shape and a size), work out where each one goes
// so the wall reads like a salon hang: large pieces alone, smaller ones stacked in pairs,
// nothing in a tidy row. The result is deterministic — the same pieces always hang the
// same way — so the server and the browser agree, and re-hanging after a filter is just
// calling this again with fewer pieces.
//
// Units: the wall is 100 tall. x runs for as long as it needs to.

export type ToHang = { id: string; ratio: number; size: 's' | 'm' | 'l' };
export type Hung = { id: string; x: number; y: number; w: number; h: number; tilt: number; depth: number };

const HEIGHT = { s: 27, m: 41, l: 60 } as const;
const MARGIN = 9; // clear wall at the head and the foot
const STACK_GAP = 6;

/** a steady 0…1 for a piece, so its small irregularities never change */
const chance = (id: string, salt: number) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
};

export function hang(works: ToHang[], start = 10): { pieces: Hung[]; width: number } {
  const pieces: Hung[] = [];
  let x = start;
  let high = true; // single mid-sized pieces alternate: one hung high, the next low
  let i = 0;

  const place = (w: ToHang, px: number, py: number) => {
    const h = HEIGHT[w.size];
    pieces.push({
      id: w.id,
      x: px,
      y: py,
      w: h * w.ratio,
      h,
      tilt: (chance(w.id, 1) - 0.5) * 3.2,
      // bigger pieces hang a touch nearer, so they slide a little faster as you walk
      depth: 0.94 + (w.size === 'l' ? 0.12 : w.size === 'm' ? 0.06 : 0) + chance(w.id, 2) * 0.05,
    });
    return h * w.ratio;
  };

  while (i < works.length) {
    const a = works[i];
    const b = works[i + 1];
    const pair = a.size !== 'l' && b && b.size !== 'l' && (a.size === 's' || b.size === 's');

    if (pair) {
      // two in one bay, one above the other, the narrower one pushed off-centre
      const ha = HEIGHT[a.size];
      const hb = HEIGHT[b.size];
      const wa = ha * a.ratio;
      const wb = hb * b.ratio;
      const bay = Math.max(wa, wb);
      const top = (100 - (ha + hb + STACK_GAP)) / 2 + (chance(a.id, 3) - 0.5) * 6;
      const side = chance(a.id, 4) > 0.5 ? 1 : 0;
      place(a, x + (bay - wa) * (side ? 0.85 : 0.1), top);
      place(b, x + (bay - wb) * (side ? 0.1 : 0.85), top + ha + STACK_GAP);
      x += bay;
      i += 2;
    } else {
      const h = HEIGHT[a.size];
      let y: number;
      if (a.size === 'l') y = (100 - h) / 2 + (chance(a.id, 3) - 0.5) * 9;
      else {
        y = high ? MARGIN + chance(a.id, 3) * 7 : 100 - MARGIN - h - chance(a.id, 3) * 7;
        high = !high;
      }
      x += place(a, x, y);
      i += 1;
    }
    // the breathing room before the next bay is never quite the same twice
    x += 9 + chance(a.id, 5) * 9;
  }

  return { pieces, width: Math.max(x + 2, 60) };
}
