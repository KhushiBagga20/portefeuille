// The art gallery (pages/playground/art.astro).
//
// Two ways of showing the same list of frames:
//   · the promenade — with a mouse on a wide screen, the wall is longer than the window
//     and scrolling walks you along it. Frames can be picked up and moved.
//   · the stack — on phones, on touch screens, with reduced motion or with no script at
//     all, the frames are simply laid out down the page.
// Either way a click opens the piece in the viewer.

import { hang, type ToHang } from './hang';

type Work = ToHang & {
  no: string;
  title: string;
  date?: string;
  medium?: string;
  collection: string;
  collectionName: string;
  description?: string;
  note?: string;
  sample?: boolean;
  full?: string;
  alt?: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function initGallery(root: HTMLElement) {
  const works: Work[] = JSON.parse(root.dataset.works!);
  const wall = root.querySelector<HTMLElement>('[data-wall]')!;
  const items = new Map([...root.querySelectorAll<HTMLElement>('[data-piece]')].map((el) => [el.dataset.piece!, el]));
  const meter = root.querySelector<HTMLElement>('[data-meter]');
  const rehang = root.querySelector<HTMLButtonElement>('[data-rehang]');
  const viewer = document.querySelector<HTMLDialogElement>('[data-viewer]');

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 900px)');
  const bar = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar')) || 52;

  let promenade = false;
  let shown = works;
  let wallW = Number(getComputedStyle(root).getPropertyValue('--wall-w')) || 100;
  let u = 1; // one wall unit, in pixels
  let span = 0; // how far the wall can slide
  let pan = 0;

  // ── walking the wall ────────────────────────
  const paint = () => {
    if (!promenade) return;
    pan = clamp(bar() - root.getBoundingClientRect().top, 0, span);
    root.style.setProperty('--pan', pan.toFixed(1));
    if (meter) meter.style.setProperty('--at', span ? (pan / span).toFixed(4) : '0');
  };

  const measure = () => {
    if (!promenade) return;
    u = wall.clientHeight / 100;
    root.style.setProperty('--u', `${u.toFixed(3)}px`);
    span = Math.max(0, wallW * u - innerWidth);
    root.classList.toggle('is-short', span === 0);
    paint();
  };

  const setMode = () => {
    promenade = fine.matches && !reduce.matches && wide.matches;
    root.classList.toggle('is-promenade', promenade);
    if (!promenade) root.style.removeProperty('--pan');
    // two frames later the pinned layout exists and can be measured
    requestAnimationFrame(() => requestAnimationFrame(measure));
  };

  let queued = false;
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => ((queued = false), paint()));
    },
    { passive: true },
  );
  addEventListener('resize', measure);
  [fine, reduce, wide].forEach((mq) => mq.addEventListener('change', setMode));

  /** the page position at which the wall has slid `to` pixels */
  const pageYFor = (to: number) => root.getBoundingClientRect().top + scrollY - bar() + clamp(to, 0, span);

  // a sideways swipe on a trackpad walks the wall too
  wall.addEventListener(
    'wheel',
    (e) => {
      if (!promenade || !span || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      scrollBy({ top: e.deltaX, behavior: 'instant' as ScrollBehavior });
    },
    { passive: false },
  );

  // ── picking frames up ───────────────────────
  // One pointer handler covers three things: a click on a frame (open it), a drag on a
  // frame (move it), and a drag on bare wall (walk along it).
  let held: { el: HTMLElement | null; id: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null = null;
  let justDragged = false;

  wall.addEventListener('pointerdown', (e) => {
    if (!promenade || e.button !== 0) return;
    const el = (e.target as Element).closest<HTMLElement>('[data-piece]');
    held = { el, id: e.pointerId, x: e.clientX, y: e.clientY, dx: Number(el?.dataset.dx ?? 0), dy: Number(el?.dataset.dy ?? 0), moved: false };
  });

  wall.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id) return;
    const mx = e.clientX - held.x;
    const my = e.clientY - held.y;
    if (!held.moved) {
      if (Math.hypot(mx, my) < 6) return;
      held.moved = true;
      try {
        wall.setPointerCapture(e.pointerId);
      } catch {}
      wall.classList.add('is-dragging');
      held.el?.classList.add('is-held');
    }
    if (held.el) {
      held.el.style.setProperty('--dx', `${held.dx + mx}px`);
      held.el.style.setProperty('--dy', `${held.dy + my}px`);
    } else {
      scrollBy({ top: -(e.clientX - held.x), behavior: 'instant' as ScrollBehavior });
      held.x = e.clientX;
    }
  });

  const drop = (e: PointerEvent) => {
    if (!held || e.pointerId !== held.id) return;
    if (held.moved) {
      justDragged = true;
      setTimeout(() => (justDragged = false), 0);
      if (held.el) {
        held.el.dataset.dx = String(held.dx + e.clientX - held.x);
        held.el.dataset.dy = String(held.dy + e.clientY - held.y);
        held.el.classList.remove('is-held');
        held.el.classList.add('is-moved');
        if (rehang) rehang.hidden = false;
      }
    }
    wall.classList.remove('is-dragging');
    held = null;
  };
  wall.addEventListener('pointerup', drop);
  wall.addEventListener('pointercancel', drop);

  const straighten = () => {
    for (const el of items.values()) {
      if (el.classList.contains('is-moved')) {
        el.classList.add('is-settling');
        setTimeout(() => el.classList.remove('is-settling'), 750);
      }
      el.style.removeProperty('--dx');
      el.style.removeProperty('--dy');
      delete el.dataset.dx;
      delete el.dataset.dy;
      el.classList.remove('is-moved');
    }
    if (rehang) rehang.hidden = true;
  };
  rehang?.addEventListener('click', straighten);

  // a frame reached with the keyboard is brought to the middle of the window
  wall.addEventListener('focusin', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-piece]');
    if (!el || !promenade || !span || held) return;
    const x = (Number(el.style.getPropertyValue('--x')) + Number(el.style.getPropertyValue('--w')) / 2) * u;
    scrollTo({ top: pageYFor(x - innerWidth / 2), behavior: 'instant' as ScrollBehavior });
  });

  wall.addEventListener('keydown', (e) => {
    if (!promenade || !span || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    scrollBy({ top: (e.key === 'ArrowRight' ? 1 : -1) * innerWidth * 0.4 });
  });

  // ── collections ─────────────────────────────
  const filters = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const show = (collection: string) => {
    shown = works.filter((w) => collection === 'all' || w.collection === collection);
    const { pieces, width } = hang(shown);
    const at = new Map(pieces.map((p) => [p.id, p]));
    straighten();
    for (const [id, el] of items) {
      const p = at.get(id);
      el.classList.toggle('is-away', !p);
      const hit = el.querySelector<HTMLButtonElement>('button');
      if (hit) hit.tabIndex = p ? 0 : -1;
      el.toggleAttribute('aria-hidden', !p);
      if (!p) continue;
      el.style.setProperty('--x', p.x.toFixed(2));
      el.style.setProperty('--y', p.y.toFixed(2));
      el.style.setProperty('--w', p.w.toFixed(2));
      el.style.setProperty('--h', p.h.toFixed(2));
      el.style.setProperty('--tilt', `${p.tilt.toFixed(2)}deg`);
      el.style.setProperty('--depth', p.depth.toFixed(3));
      el.classList.toggle('piece--low', p.y + p.h > 84);
    }
    wallW = width;
    root.style.setProperty('--wall-w', width.toFixed(1));
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === collection)));
    const count = root.querySelector('[data-count]');
    if (count) count.textContent = String(shown.length).padStart(2, '0');
    if (promenade) scrollTo({ top: pageYFor(0), behavior: 'instant' as ScrollBehavior });
    measure();
  };
  filters.forEach((b) => b.addEventListener('click', () => show(b.dataset.filter!)));

  // ── the viewer ──────────────────────────────
  if (viewer) {
    const stage = viewer.querySelector<HTMLElement>('[data-viewer-art]')!;
    const field = (name: string) => viewer.querySelector<HTMLElement>(`[data-v="${name}"]`);
    const row = (name: string) => viewer.querySelector<HTMLElement>(`[data-v-row="${name}"]`);
    let current = -1;
    let cameFrom: HTMLElement | null = null;

    const fill = (i: number) => {
      const w = shown[i];
      current = i;
      const set = (name: string, text?: string) => {
        const el = field(name);
        const holder = row(name) ?? el;
        if (el) el.textContent = text ?? '';
        if (holder) holder.hidden = !text;
      };
      set('count', `${String(i + 1).padStart(2, '0')} / ${String(shown.length).padStart(2, '0')}`);
      set('collection', w.collectionName);
      set('title', w.title);
      set('date', w.date);
      set('medium', w.medium);
      set('description', w.description);
      set('note', w.note);
      const sample = viewer.querySelector<HTMLElement>('[data-v-sample]');
      if (sample) sample.hidden = !w.sample;

      // the picture itself: the full-size image, or a copy of the labelled empty frame
      stage.classList.remove('is-zoomed');
      stage.style.setProperty('--ratio', String(w.ratio));
      const source = items.get(w.id)?.querySelector<HTMLElement>('[data-art]');
      let art: HTMLElement;
      if (w.full) {
        const img = new Image();
        img.src = w.full;
        img.alt = w.alt ?? w.title;
        img.draggable = false;
        art = img;
      } else {
        art = source!.cloneNode(true) as HTMLElement;
        // the copy leaves the frame it was tinted by: carry the colour with it
        art.style.setProperty('--tint', getComputedStyle(source!).getPropertyValue('--tint'));
      }
      stage.classList.toggle('is-image', Boolean(w.full));
      stage.replaceChildren(art);
      try {
        history.replaceState(history.state, '', `#${w.id}`);
      } catch {}
    };

    /** the picture travels from where it hangs to where it is shown (and back) */
    const travel = (from: DOMRect | undefined, reverse = false) => {
      if (!from || reduce.matches || !stage.animate) return Promise.resolve();
      const to = stage.getBoundingClientRect();
      const frames = [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
        { transform: 'none' },
      ];
      return stage.animate(reverse ? frames.reverse() : frames, { duration: 520, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }).finished.catch(() => undefined);
    };

    const open = (id: string, animate = true) => {
      const i = shown.findIndex((w) => w.id === id);
      if (i < 0) return;
      cameFrom = items.get(id)?.querySelector<HTMLElement>('[data-art]') ?? null;
      const from = animate ? cameFrom?.getBoundingClientRect() : undefined;
      fill(i);
      viewer.showModal();
      viewer.classList.add('is-open');
      void travel(from);
    };

    const close = async () => {
      if (!viewer.open) return;
      viewer.classList.remove('is-open');
      const back = items.get(shown[current]?.id)?.querySelector<HTMLElement>('[data-art]');
      await travel(back?.getBoundingClientRect(), true);
      viewer.close();
      try {
        history.replaceState(history.state, '', location.pathname + location.search);
      } catch {}
      items.get(shown[current]?.id)?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    };

    const step = (by: number) => {
      if (!shown.length) return;
      fill((current + by + shown.length) % shown.length);
      if (!reduce.matches) stage.animate([{ opacity: 0, translate: `${by * 28}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    };

    root.addEventListener('click', (e) => {
      const hit = (e.target as Element).closest<HTMLElement>('[data-piece] button');
      if (!hit || justDragged) return;
      open(hit.closest<HTMLElement>('[data-piece]')!.dataset.piece!);
    });

    viewer.querySelector('[data-viewer-close]')?.addEventListener('click', close);
    viewer.querySelector('[data-viewer-prev]')?.addEventListener('click', () => step(-1));
    viewer.querySelector('[data-viewer-next]')?.addEventListener('click', () => step(1));
    viewer.addEventListener('cancel', (e) => (e.preventDefault(), void close()));
    viewer.addEventListener('click', (e) => e.target === viewer && void close());
    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    });

    // look closer: a click on a real picture zooms into the spot under the cursor
    stage.addEventListener('click', () => stage.classList.contains('is-image') && stage.classList.toggle('is-zoomed'));
    stage.addEventListener('pointermove', (e) => {
      if (!stage.classList.contains('is-zoomed')) return;
      const r = stage.getBoundingClientRect();
      stage.style.setProperty('--zx', `${clamp(((e.clientX - r.left) / r.width) * 100, 0, 100).toFixed(1)}%`);
      stage.style.setProperty('--zy', `${clamp(((e.clientY - r.top) / r.height) * 100, 0, 100).toFixed(1)}%`);
    });

    // a link straight to one piece opens it
    const wanted = decodeURIComponent(location.hash.slice(1));
    if (wanted && items.has(wanted)) requestAnimationFrame(() => open(wanted, false));
  }

  setMode();
  document.fonts?.ready.then(measure);
}
