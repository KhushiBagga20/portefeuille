// A real 3×3 Rubik's cube: 26 cubies, each carrying its own orientation, drawn as
// depth-sorted SVG polygons through an orthographic camera.
//
// Orbit it by dragging the background. Turn a layer by dragging a sticker — the drag
// direction is projected onto the two in-face axes and the nearer one wins, which is
// how a real cube answers your thumb.
//
// The cube keeps a log of every turn. "Solve" doesn't cheat by snapping home: it plays
// the log backwards, so you watch it undo itself.

type Vec = [number, number, number];
/** row-major 3×3, as nine numbers */
type Mat = number[];
/** [axis 0|1|2, layer -1|0|1, direction ±1] */
type Move = [number, number, number];

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
/** rotation about axis 0|1|2 by `a` radians (right-handed: positive is anticlockwise seen from +axis) */
function rot(axis: number, a: number): Mat {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
const round = (v: Vec): Vec => v.map((n) => Math.round(n)) as Vec;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

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

// ── notation ──────────────────────────────────
// Which named layer a move turns, and which way round counts as clockwise for it
// (clockwise as seen from outside that face; slices follow the face they're named after).
const LAYER: Record<string, string> = {
  '0,1': 'R',
  '0,-1': 'L',
  '0,0': 'M',
  '1,1': 'U',
  '1,-1': 'D',
  '1,0': 'E',
  '2,1': 'F',
  '2,-1': 'B',
  '2,0': 'S',
};
const CLOCKWISE: Record<string, number> = { R: -1, L: 1, M: 1, U: -1, D: 1, E: 1, F: -1, B: 1, S: -1 };
const notate = ([axis, layer, dir]: Move) => {
  const name = LAYER[`${axis},${layer}`];
  return name + (dir === CLOCKWISE[name] ? '' : '′');
};

/** Cancel turns that undo each other and fold three-of-a-kind into one the other way. */
function compress(seq: Move[]): Move[] {
  const runs: Move[] = [];
  for (const [axis, layer, dir] of seq) {
    const top = runs[runs.length - 1];
    if (top && top[0] === axis && top[1] === layer) {
      top[2] += dir;
      if (top[2] % 4 === 0) runs.pop();
    } else runs.push([axis, layer, dir]);
  }
  return runs.flatMap(([axis, layer, n]): Move[] => {
    const q = ((n % 4) + 4) % 4;
    if (q === 1) return [[axis, layer, 1]];
    if (q === 2) return [[axis, layer, 1], [axis, layer, 1]];
    if (q === 3) return [[axis, layer, -1]];
    return [];
  });
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initRubik(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-cube]');
  const group = root.querySelector<SVGGElement>('[data-cubies]');
  if (!svg || !group) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stickers: string[] = JSON.parse(root.dataset.colors ?? '[]');
  const PLASTIC = root.dataset.plastic ?? '#0c0d21';
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
        const skin = FACES.map(([a, s], f) => ([x, y, z][a] === s ? stickers[f] : null));
        cubies.push({ p: [x, y, z], m: [...ID], skin });
      }

  const snapHome = () => {
    let i = 0;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          cubies[i].p = [x, y, z];
          cubies[i].m = [...ID];
          i++;
        }
  };

  /** Solved means every side shows one colour — whichever way up the cube has ended. */
  const isSolved = () => {
    const side: Record<string, string> = {};
    for (const c of cubies)
      for (let f = 0; f < 6; f++) {
        const colour = c.skin[f];
        if (!colour) continue;
        const n: Vec = [0, 0, 0];
        n[FACES[f][0]] = FACES[f][1];
        const key = round(apply(c.m, n)).join();
        if (side[key] === undefined) side[key] = colour;
        else if (side[key] !== colour) return false;
      }
    return true;
  };

  // ── camera ──────────────────────────────────
  let yaw = -0.62;
  let pitch = 0.5;
  const view = () => mul(rot(0, pitch), rot(1, yaw));

  // ── turns ───────────────────────────────────
  type Job = { move: Move; ms: number; log: boolean; count: boolean };
  let turn: (Job & { t: number }) | null = null;
  const queue: Job[] = [];
  const history: Move[] = []; // every turn since the cube was last whole
  let moves = 0; // turns made by hand
  let mode: 'idle' | 'scrambling' | 'solving' = 'idle';
  let wasScrambled = false;

  // ── readouts ────────────────────────────────
  const out = {
    moves: root.querySelector<HTMLElement>('[data-moves]'),
    state: root.querySelector<HTMLElement>('[data-state]'),
    last: root.querySelector<HTMLElement>('[data-last]'),
    rot: root.querySelector<HTMLElement>('[data-rot]'),
    dial: root.querySelector<SVGGElement>('[data-dial]'),
  };
  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  root.append(live);
  const say = (text: string) => (live.textContent = text);

  const report = (last?: string) => {
    if (out.moves) out.moves.textContent = String(moves).padStart(3, '0');
    if (out.state) out.state.textContent = mode === 'idle' ? (isSolved() ? 'solved' : 'scrambled') : mode;
    if (out.last && last !== undefined) out.last.textContent = last;
  };

  let lastDeg = -1;
  const reportCamera = () => {
    const deg = ((Math.round((yaw * 180) / Math.PI) % 360) + 360) % 360;
    if (deg === lastDeg) return;
    lastDeg = deg;
    if (out.rot) out.rot.textContent = `${String(deg).padStart(3, '0')}°`;
    if (out.dial) out.dial.style.rotate = `${deg}deg`;
  };

  // ── polygon pool ────────────────────────────
  const pool: SVGPolygonElement[] = [];
  const getPoly = (i: number) => {
    if (!pool[i]) {
      const el = document.createElementNS(SVG_NS, 'polygon');
      el.setAttribute('stroke-linejoin', 'round');
      el.setAttribute('stroke-width', '7');
      el.style.stroke = PLASTIC;
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
      const spinning = turn && Math.round(c.p[turn.move[0]]) === turn.move[1];
      const spin = spinning ? rot(turn!.move[0], turn!.move[2] * turn!.t * (Math.PI / 2)) : null;
      const origin: Vec = spin ? apply(spin, c.p) : c.p;
      const orient = spin ? mul(spin, c.m) : c.m;

      for (let f = 0; f < 6; f++) {
        const [axis, sign] = FACES[f];
        const local: Vec = [0, 0, 0];
        local[axis] = sign;
        const nView = apply(V, apply(orient, local));
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
      el.style.fill = q.fill;
      if (q.hit) hits.set(el, q.hit);
      else hits.delete(el);
      el.style.cursor = q.hit ? 'grab' : 'default';
      nodes.push(el);
    });
    group!.replaceChildren(...nodes);
    reportCamera();
  }

  // ── animation ───────────────────────────────
  let raf = 0;
  let last = 0;
  let idle = !reduceMotion.matches;
  let dragging = false;

  /** A turn has reached 90°: rewrite the layer's cubies into their new integer homes. */
  function commit(job: Job) {
    const [axis, layer, dir] = job.move;
    const R = rot(axis, dir * (Math.PI / 2));
    for (const c of cubies)
      if (Math.round(c.p[axis]) === layer) {
        c.p = round(apply(R, c.p));
        c.m = mul(R, c.m).map((n) => Math.round(n));
      }
    if (job.log) history.push(job.move);
    if (!job.count) return;

    moves++;
    const name = notate(job.move);
    if (isSolved()) {
      history.length = 0;
      report(name);
      if (wasScrambled) {
        wasScrambled = false;
        root.classList.remove('is-won');
        void root.offsetWidth;
        root.classList.add('is-won');
        say(`Solved by hand in ${moves} moves.`);
      }
    } else {
      report(name);
      say(`Turned ${name.replace('′', ' prime')}.`);
    }
  }

  /** The queue has run dry: settle whatever show was on. */
  function settle() {
    if (mode === 'solving') {
      snapHome();
      history.length = 0;
      moves = 0;
      wasScrambled = false;
      mode = 'idle';
      report('—');
      say('Solved.');
    } else if (mode === 'scrambling') {
      mode = 'idle';
      report(history.length ? notate(history[history.length - 1]) : '—');
      say('Scrambled.');
    }
  }

  function frame(now: number) {
    const dt = Math.min(50, last ? now - last : 16);
    last = now;

    if (!turn && queue.length) turn = { ...queue.shift()!, t: 0 };

    if (turn) {
      turn.t += dt / turn.ms;
      if (turn.t >= 1) {
        commit(turn);
        turn = queue.length ? { ...queue.shift()!, t: 0 } : null;
        if (!turn) settle();
      }
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

  /** A turn asked for by a person: a drag, a button, a key. */
  const userTurn = (move: Move) => {
    if (mode !== 'idle' || queue.length > 12) return;
    if (reduceMotion.matches) {
      // no animation: do it, show it
      commit({ move, ms: 1, log: true, count: true });
      draw();
      return;
    }
    queue.push({ move, ms: 240, log: true, count: true });
    kick();
  };

  // ── pointer ─────────────────────────────────
  let gesture: 'orbit' | 'turn' | null = null;
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
    gesture = null;
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

    if (!gesture) {
      if (Math.hypot(dx, dy) < 9) return;
      gesture = grabbed && !turn && mode === 'idle' ? 'turn' : 'orbit';
    }

    if (gesture === 'orbit') {
      yaw += dx * 0.009;
      pitch = clamp(pitch + dy * 0.009, -1.35, 1.35);
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

    gesture = null;
    dragging = false;
    grabbed = null;
    userTurn([rotAxis, layer, dir]);
  });

  const release = () => {
    dragging = false;
    gesture = null;
    grabbed = null;
    if (!reduceMotion.matches) {
      idle = onScreen;
      kick();
    }
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  // ── scramble / solve ────────────────────────
  root.querySelector('[data-scramble]')?.addEventListener('click', () => {
    if (mode !== 'idle') return;
    const plan: Move[] = [];
    let prev = '';
    while (plan.length < 18) {
      const axis = Math.floor(Math.random() * 3);
      const layer = [-1, 0, 1][Math.floor(Math.random() * 3)];
      if (`${axis}${layer}` === prev) continue; // never straight back the way it came
      prev = `${axis}${layer}`;
      plan.push([axis, layer, Math.random() < 0.5 ? 1 : -1]);
    }
    moves = 0;
    wasScrambled = true;
    root.classList.remove('is-won');
    if (reduceMotion.matches) {
      plan.forEach((move) => commit({ move, ms: 1, log: true, count: false }));
      report(notate(plan[plan.length - 1]));
      say('Scrambled.');
      draw();
      return;
    }
    mode = 'scrambling';
    report('…');
    plan.forEach((move) => queue.push({ move, ms: 115, log: true, count: false }));
    kick();
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    queue.length = 0;
    root.classList.remove('is-won');
    // a turn caught in the air lands first, so the log is whole
    if (turn) {
      commit({ ...turn, count: false });
      turn = null;
    }
    const plan = compress(history.slice().reverse().map(([a, l, d]): Move => [a, l, -d]));

    // nothing to undo, no motion wanted, or a second press mid-show: just be solved
    if (!plan.length || reduceMotion.matches || mode === 'solving') {
      mode = 'solving';
      settle();
      draw();
      return;
    }
    mode = 'solving';
    report('…');
    const ms = clamp(1900 / plan.length, 40, 150);
    plan.forEach((move) => queue.push({ move, ms, log: false, count: false }));
    kick();
  });

  // ── the notation pad, and the same letters on a real keyboard ──
  const prime = root.querySelector<HTMLButtonElement>('[data-prime]');
  const isPrime = () => prime?.getAttribute('aria-pressed') === 'true';
  prime?.addEventListener('click', () => prime.setAttribute('aria-pressed', String(!isPrime())));

  const pad = new Map<string, { button: HTMLButtonElement; move: Move }>();
  root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
    const move = (button.dataset.move ?? '').split(',').map(Number) as Move;
    if (button.dataset.letter) pad.set(button.dataset.letter, { button, move });
    button.addEventListener('click', () => userTurn([move[0], move[1], isPrime() ? -move[2] : move[2]]));
  });

  let onScreen = false;
  let inFocus = false;
  new IntersectionObserver(([entry]) => (inFocus = entry.isIntersecting), { threshold: 0.6 }).observe(svg);

  addEventListener('keydown', (e) => {
    if (!inFocus || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]')) return;
    const hit = pad.get(e.key.toUpperCase());
    if (!hit) return;
    const flip = e.shiftKey !== isPrime();
    userTurn([hit.move[0], hit.move[1], flip ? -hit.move[2] : hit.move[2]]);
    hit.button.classList.add('is-hit');
    window.setTimeout(() => hit.button.classList.remove('is-hit'), 140);
  });

  // Only spin while it's on screen.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    idle = onScreen && !reduceMotion.matches && !dragging;
    if (onScreen) kick();
  }).observe(svg);

  draw();
  report('—');
  if (!reduceMotion.matches) kick();
}
