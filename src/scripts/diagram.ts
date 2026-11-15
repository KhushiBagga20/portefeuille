// The architecture diagrams (components/case/Diagram.astro): pick a part, zoom, pan.
//
// Everything is progressive. Without this script the drawing is a still picture and the
// explanations sit hidden; so the first thing it does is make sure a reader with no pointer
// and no patience can still get all of it — the "list" view shows every part in words.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function initDiagram(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-canvas]');
  const view = root.querySelector<SVGGElement>('[data-viewport]');
  if (!svg || !view) return;

  const [bx, by, bw, bh] = svg.dataset.box!.split(' ').map(Number);
  const nodes = [...root.querySelectorAll<SVGGElement>('[data-node]')];
  const edges = [...root.querySelectorAll<SVGGElement>('[data-edge]')];
  const details = [...root.querySelectorAll<HTMLElement>('[data-detail]')];
  const empty = root.querySelector<HTMLElement>('[data-empty]');

  // ── choosing a part ─────────────────────────
  let chosen: string | null = null;

  const choose = (id: string | null) => {
    chosen = id;
    root.toggleAttribute('data-active', Boolean(id));
    const near = new Set<string>(id ? [id] : []);
    for (const e of edges) {
      const touches = Boolean(id) && (e.dataset.from === id || e.dataset.to === id);
      e.classList.toggle('is-near', touches);
      if (touches) near.add(e.dataset.from!), near.add(e.dataset.to!);
    }
    for (const n of nodes) {
      n.setAttribute('aria-pressed', String(n.dataset.node === id));
      n.classList.toggle('is-near', near.has(n.dataset.node!));
    }
    if (root.dataset.layout === 'list') return;
    for (const d of details) d.hidden = d.dataset.detail !== id;
    if (empty) empty.hidden = Boolean(id);
  };

  // ── zoom and pan ────────────────────────────
  // The drawing lives in its own units (the viewBox). `k` scales it and (x, y) slides it,
  // both applied to the group inside, so the SVG element itself never changes size.
  const t = { k: 1, x: 0, y: 0 };
  let home = { k: 1, x: 0, y: 0 };

  const apply = () => view.setAttribute('transform', `translate(${t.x.toFixed(2)} ${t.y.toFixed(2)}) scale(${t.k.toFixed(4)})`);

  /** how many drawing units one screen pixel covers right now */
  const unit = () => {
    const r = svg.getBoundingClientRect();
    return Math.max(bw / r.width, bh / r.height);
  };

  /** keep at least a third of the drawing on screen. A point p of the drawing lands at
   *  p·k + t, and the window is (about) the viewBox itself. */
  const bound = () => {
    t.x = clamp(t.x, bx + bw / 3 - (bx + bw) * t.k, bx + (bw * 2) / 3 - bx * t.k);
    t.y = clamp(t.y, by + bh / 3 - (by + bh) * t.k, by + (bh * 2) / 3 - by * t.k);
  };

  /** zoom by `factor`, holding the drawing point under (cx, cy) still (drawing units) */
  const zoomAt = (factor: number, cx: number, cy: number) => {
    const k = clamp(t.k * factor, home.k * 0.6, Math.max(3, home.k * 3));
    const f = k / t.k;
    t.x = cx - (cx - t.x) * f;
    t.y = cy - (cy - t.y) * f;
    t.k = k;
    bound();
    apply();
  };

  /** a screen position → drawing units (before the pan/zoom transform) */
  const toDrawing = (clientX: number, clientY: number) => {
    const r = svg.getBoundingClientRect();
    const u = unit();
    // the viewBox is centred in the element (preserveAspectRatio: xMidYMid meet)
    const ox = (r.width * u - bw) / 2;
    const oy = (r.height * u - bh) / 2;
    return [bx - ox + (clientX - r.left) * u, by - oy + (clientY - r.top) * u] as const;
  };

  /** Start at a size where the labels can be read. On a wide screen the whole drawing
   *  fits. On a phone it would shrink to nothing, so it is shown at reading size instead:
   *  as tall as it needs to be, its left edge in view, and it slides sideways. */
  const READABLE = 1 / 0.86; // drawing units per pixel at which a label is still ~12.5px
  const fit = () => {
    svg.style.height = '';
    home = { k: 1, x: 0, y: 0 };
    if (unit() > READABLE) {
      svg.style.height = `${Math.ceil(bh / READABLE) + 28}px`;
      const u = unit();
      const k = u / READABLE;
      const r = svg.getBoundingClientRect();
      const [left, top] = toDrawing(r.left, r.top);
      home = { k, x: left - bx * k + 14 * u, y: top - by * k + 14 * u };
    }
    Object.assign(t, home);
    apply();
  };

  const centre = () => {
    const r = svg.getBoundingClientRect();
    return toDrawing(r.left + r.width / 2, r.top + r.height / 2);
  };

  root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.zoom === 'fit') return fit();
      const [cx, cy] = centre();
      zoomAt(b.dataset.zoom === 'in' ? 1.35 : 1 / 1.35, cx, cy);
    }),
  );

  // Scrolling the page must keep scrolling the page: the wheel only zooms with ⌘/ctrl held
  // (which is also what a trackpad pinch sends).
  svg.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [cx, cy] = toDrawing(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.012), cx, cy);
    },
    { passive: false },
  );

  // drag to pan; two fingers to pinch
  const fingers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch = 0;

  svg.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (fingers.size === 2) {
      const [a, b] = [...fingers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  svg.addEventListener('pointermove', (e) => {
    const was = fingers.get(e.pointerId);
    if (!was) return;
    const dx = e.clientX - was.x;
    const dy = e.clientY - was.y;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (fingers.size === 2) {
      const [a, b] = [...fingers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) {
        const [cx, cy] = toDrawing((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(d / pinch, cx, cy);
      }
      pinch = d;
      moved = 99;
      return;
    }

    moved += Math.abs(dx) + Math.abs(dy);
    if (moved < 6) return;
    // On touch, an up-and-down drag belongs to the page (touch-action: pan-y) and the
    // browser cancels the pointer; what arrives here is a sideways drag, or a mouse.
    if (!svg.hasPointerCapture(e.pointerId)) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {}
      svg.classList.add('is-dragging');
    }
    const u = unit();
    t.x += dx * u;
    t.y += e.pointerType === 'touch' ? 0 : dy * u;
    bound();
    apply();
  });

  const lift = (e: PointerEvent) => {
    fingers.delete(e.pointerId);
    pinch = 0;
    svg.classList.remove('is-dragging');
  };
  svg.addEventListener('pointerup', lift);
  svg.addEventListener('pointercancel', lift);

  // a click that wasn't the end of a drag chooses a part; a click on empty paper lets go
  svg.addEventListener('click', (e) => {
    if (moved >= 6) return;
    const node = (e.target as Element).closest<SVGGElement>('[data-node]');
    choose(node ? (node.dataset.node === chosen ? null : node.dataset.node!) : null);
  });

  for (const n of nodes) {
    n.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      choose(n.dataset.node === chosen ? null : n.dataset.node!);
    });
  }

  // arrows slide the drawing, + and − zoom it, 0 puts it back
  svg.addEventListener('keydown', (e) => {
    const step = 40 * unit();
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (t.x += step),
      ArrowRight: () => (t.x -= step),
      ArrowUp: () => (t.y += step),
      ArrowDown: () => (t.y -= step),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moves[e.key]();
      bound();
      apply();
    } else if (e.key === '+' || e.key === '=') zoomAt(1.25, ...centre());
    else if (e.key === '-') zoomAt(0.8, ...centre());
    else if (e.key === '0') fit();
    else if (e.key === 'Escape') choose(null);
  });

  // ── map / list ──────────────────────────────
  const setMode = (mode: 'map' | 'list') => {
    root.dataset.layout = mode;
    root.querySelectorAll<HTMLButtonElement>('[data-mode-to]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modeTo === mode)));
    if (mode === 'list') {
      for (const d of details) d.hidden = false;
      if (empty) empty.hidden = true;
    } else {
      choose(chosen);
      requestAnimationFrame(fit);
    }
  };
  root.querySelectorAll<HTMLButtonElement>('[data-mode-to]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.modeTo as 'map' | 'list')));

  // ── go ──────────────────────────────────────
  fit();
  let width = svg.clientWidth;
  new ResizeObserver(() => {
    if (svg.clientWidth === width) return;
    width = svg.clientWidth;
    fit();
  }).observe(svg);
}
