// A real 3×3 Rubik's cube: 26 cubies, each carrying its own orientation, drawn as
// depth-sorted SVG polygons through an orthographic camera.
//
// Orbit it by dragging the background. Turn a layer by dragging a sticker — the drag
// direction is projected onto the two in-face axes and the nearer one wins, which is
// how a real cube answers your thumb.

type Vec = [number, number, number];
/** column-major 3×3, as nine numbers */
type Mat = number[];

const ID: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const mul = (a: Mat, b: Mat): Mat => {
  const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return o;
};
const apply = (m: Mat, v: Vec): Vec => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
/** rotation about axis 0|1|2 by `a` radians */
function rot(axis: number, a: number): Mat {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
const round = (v: Vec): Vec => v.map((n) => Math.round(n)) as Vec;

// local faces of one cubie: [axis, sign]
const FACES: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [2, 1],
  [2, -1],
];

/** the four corners of a cubie face, in cubie-local space */
function faceCorners(axis: number, sign: number, h: number): Vec[] {
  const u: Vec = [0, 0, 0];
  const v: Vec = [0, 0, 0];
  const n: Vec = [0, 0, 0];
  n[axis] = sign * h;
  u[(axis + 1) % 3] = h;
  v[(axis + 2) % 3] = h;
  const add = (...vs: Vec[]): Vec => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as Vec, [0, 0, 0] as Vec);
  const neg = (a: Vec): Vec => [-a[0], -a[1], -a[2]];
  return sign > 0
    ? [add(n, neg(u), neg(v)), add(n, u, neg(v)), add(n, u, v), add(n, neg(u), v)]
    : [add(n, neg(u), neg(v)), add(n, neg(u), v), add(n, u, v), add(n, u, neg(v))];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initRubik(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-cube]');
  const group = root.querySelector<SVGGElement>('[data-cubies]');
  if (!svg || !group) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stickers: string[] = JSON.parse(root.dataset.colors ?? '[]');
  const PLASTIC = root.dataset.plastic ?? '#1b1526';
  // worst-case corner is sqrt(3) * (GAP + H) from the centre, so keep it inside the viewBox
  const SIZE = 116;
  const GAP = 1.06;
  const H = 0.5;

  // ── the cube ────────────────────────────────
  type Cubie = { p: Vec; m: Mat; skin: (string | null)[] };
  const cubies: Cubie[] = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const skin = FACES.map(([a, s]) => {
          const at = [x, y, z][a];
          return at === s ? stickers[FACES.findIndex(([fa, fs]) => fa === a && fs === s)] : null;
        });
        cubies.push({ p: [x, y, z], m: [...ID], skin });
      }

  // ── camera ──────────────────────────────────
  let yaw = -0.62;
  let pitch = -0.52;
  const view = () => mul(rot(0, pitch), rot(1, yaw));

  // ── a turn in progress ──────────────────────
  let turn: { axis: number; layer: number; dir: number; t: number } | null = null;
  const queue: [number, number, number][] = [];

  // ── polygon pool ────────────────────────────
  const pool: SVGPolygonElement[] = [];
  const getPoly = (i: number) => {
    if (!pool[i]) {
      const el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('stroke-linejoin', 'round');
      pool[i] = el;
    }
    return pool[i];
  };

  type Hit = { cubie: Cubie; axis: number; sign: number };
  const hits = new WeakMap<SVGPolygonElement, Hit>();

  function draw() {
    const V = view();
    const quads: { pts: string; fill: string; depth: number; hit: Hit | null }[] = [];

    for (const c of cubies) {
      // a cubie caught mid-turn gets the extra spin on top of everything else
      const spin = turn && Math.round(c.p[turn.axis]) === turn.layer ? rot(turn.axis, turn.dir * turn.t * (Math.PI / 2)) : null;
      const origin: Vec = spin ? apply(spin, c.p) : c.p;
      const orient = spin ? mul(spin, c.m) : c.m;

      for (let f = 0; f < 6; f++) {
        const [axis, sign] = FACES[f];
        const nWorld = apply(orient, FACES[f].reduce<Vec>((n, _, i) => (i === 0 ? ((n[axis] = sign), n) : n), [0, 0, 0]));
        const nView = apply(V, nWorld);
        if (nView[2] <= 0.0001) continue; // facing away

        let sum = 0;
        const pts = faceCorners(axis, sign, H)
          .map((corner) => {
            const w = apply(orient, corner);
            const p: Vec = [origin[0] * GAP + w[0], origin[1] * GAP + w[1], origin[2] * GAP + w[2]];
            const s = apply(V, p);
            sum += s[2];
            return `${(s[0] * SIZE).toFixed(1)},${(-s[1] * SIZE).toFixed(1)}`;
          })
          .join(' ');

        quads.push({ pts, fill: c.skin[f] ?? PLASTIC, depth: sum / 4, hit: c.skin[f] ? { cubie: c, axis, sign } : null });
      }
    }

    quads.sort((a, b) => a.depth - b.depth);
    const nodes: SVGPolygonElement[] = [];
    quads.forEach((q, i) => {
      const el = getPoly(i);
      el.setAttribute('points', q.pts);
      el.setAttribute('fill', q.fill);
      el.setAttribute('stroke', PLASTIC);
      el.setAttribute('stroke-width', '7');
      if (q.hit) hits.set(el, q.hit);
      else hits.delete(el);
      el.style.cursor = q.hit ? 'grab' : 'default';
      nodes.push(el);
    });
    group!.replaceChildren(...nodes);
  }

  // ── animation ───────────────────────────────
  let raf = 0;
  let last = 0;
  let idle = !reduceMotion.matches;

  function frame(now: number) {
    const dt = Math.min(50, last ? now - last : 16);
    last = now;

    if (turn) {
      turn.t += dt / 260;
      if (turn.t >= 1) {
        // commit: snap the layer's cubies to their new home
        const R = rot(turn.axis, turn.dir * (Math.PI / 2));
        for (const c of cubies)
          if (Math.round(c.p[turn.axis]) === turn.layer) {
            c.p = round(apply(R, c.p));
            c.m = mul(R, c.m);
          }
        turn = null;
        const next = queue.shift();
        if (next) turn = { axis: next[0], layer: next[1], dir: next[2], t: 0 };
      }
    } else if (queue.length) {
      const next = queue.shift()!;
      turn = { axis: next[0], layer: next[1], dir: next[2], t: 0 };
    } else if (idle && !dragging) {
      yaw += dt * 0.00016;
    }

    draw();
    if (turn || queue.length || (idle && !dragging)) raf = requestAnimationFrame(frame);
    else (raf = 0), (last = 0);
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const enqueue = (axis: number, layer: number, dir: number) => {
    if (queue.length > 12) return;
    queue.push([axis, layer, dir]);
    kick();
  };

  // ── pointer ─────────────────────────────────
  let dragging = false;
  let mode: 'orbit' | 'turn' | null = null;
  let startX = 0;
  let startY = 0;
  let grabbed: Hit | null = null;

  const toLocal = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    dragging = true;
    mode = null;
    const l = toLocal(e);
    startX = l.x;
    startY = l.y;
    grabbed = hits.get(e.target as SVGPolygonElement) ?? null;
    idle = false;
  });

  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const l = toLocal(e);
    const dx = l.x - startX;
    const dy = l.y - startY;

    if (!mode) {
      if (Math.hypot(dx, dy) < 9) return;
      mode = grabbed && !turn ? 'turn' : 'orbit';
    }

    if (mode === 'orbit') {
      yaw += dx * 0.009;
      pitch = Math.max(-1.35, Math.min(1.35, pitch + dy * 0.009));
      startX = l.x;
      startY = l.y;
      draw();
      return;
    }

    // Turning: project the two in-face axes to the screen and see which one the
    // drag is chasing. The rotation axis is the third one.
    if (!grabbed || turn) return;
    const V = view();
    const screenOf = (v: Vec) => {
      const s = apply(V, v);
      return [s[0], -s[1]];
    };
    let best = { axis: -1, score: 0, sign: 1 };
    for (let a = 0; a < 3; a++) {
      if (a === grabbed.axis) continue;
      const unit: Vec = [0, 0, 0];
      unit[a] = 1;
      const [sx, sy] = screenOf(unit);
      const score = dx * sx + dy * sy;
      if (Math.abs(score) > Math.abs(best.score)) best = { axis: a, score, sign: Math.sign(score) || 1 };
    }
    if (best.axis < 0) return;

    // rotate about the axis perpendicular to both the face normal and the drag
    const rotAxis = 3 - grabbed.axis - best.axis;
    const layer = Math.round(grabbed.cubie.p[rotAxis]);
    // handedness: cross(faceNormal, dragAxis) points along +rotAxis or -rotAxis
    const parity = (grabbed.axis + 1) % 3 === best.axis ? 1 : -1;
    const dir = -best.sign * parity * grabbed.sign;

    mode = null;
    dragging = false;
    grabbed = null;
    enqueue(rotAxis, layer, dir);
  });

  const release = () => {
    dragging = false;
    mode = null;
    grabbed = null;
    if (!reduceMotion.matches) {
      idle = true;
      kick();
    }
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  // ── buttons ─────────────────────────────────
  root.querySelector('[data-scramble]')?.addEventListener('click', () => {
    for (let i = 0; i < 12; i++) enqueue(Math.floor(Math.random() * 3), [-1, 0, 1][Math.floor(Math.random() * 3)], Math.random() < 0.5 ? 1 : -1);
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    queue.length = 0;
    turn = null;
    let i = 0;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          cubies[i].p = [x, y, z];
          cubies[i].m = [...ID];
          i++;
        }
    draw();
  });

  // keyboard: turn the three middle-facing layers without a mouse
  root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) =>
    b.addEventListener('click', () => {
      const [a, l, d] = (b.dataset.move ?? '').split(',').map(Number);
      enqueue(a, l, d);
    }),
  );

  // Only spin while it's on screen.
  new IntersectionObserver(([entry]) => {
    idle = entry.isIntersecting && !reduceMotion.matches && !dragging;
    if (entry.isIntersecting) kick();
  }).observe(svg);

  draw();
  if (!reduceMotion.matches) kick();
}
