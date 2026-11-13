// Shared motion for the whole site.
//
// Everything here is progressive. With no JS the page is complete and still. With reduced
// motion nothing follows the cursor or the scroll, and jumps land instantly.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── 1 · entrances ─────────────────────────────
   [data-reveal] fades up once, the first time it's on screen. */
function reveals() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
  );
  els.forEach((el) => io.observe(el));
}

/* ── 2 · scroll progress ───────────────────────
   [data-view] gets two numbers while it's near the screen:
     --enter    0 → 1 as its top edge travels from the bottom of the viewport to the top
     --through  0 → 1 across its whole pass through the viewport
   CSS does the rest (domes that grow, discs that drift). */
function views() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-view]')];
  if (!els.length) return;
  if (reduce.matches) return; // CSS defaults describe the finished state

  const near = new Set<HTMLElement>();
  const measure = (el: HTMLElement) => {
    const vh = innerHeight;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--enter', clamp((vh - r.top) / vh).toFixed(4));
    el.style.setProperty('--through', clamp((vh - r.top) / (vh + r.height)).toFixed(4));
  };

  let queued = false;
  const paint = () => {
    queued = false;
    near.forEach(measure);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) near.add(el);
        else near.delete(el);
        measure(el); // one last honest reading on the way out, so nothing sticks at 0.97
      }
    },
    { rootMargin: '25% 0px 25% 0px' },
  );
  els.forEach((el) => (measure(el), io.observe(el)));
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
}

/* ── 3 · the cursor ────────────────────────────
   [data-pointer] gets --px / --py in -1…1, measured across the element. */
function pointers() {
  if (reduce.matches || !fine.matches) return;
  document.querySelectorAll<HTMLElement>('[data-pointer]').forEach((el) => {
    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      el.style.setProperty('--px', x.toFixed(3));
      el.style.setProperty('--py', y.toFixed(3));
    };
    el.addEventListener(
      'pointermove',
      (e) => {
        const r = el.getBoundingClientRect();
        x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
        y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { passive: true },
    );
    el.addEventListener('pointerleave', () => {
      x = y = 0;
      if (!raf) raf = requestAnimationFrame(paint);
    });
  });
}

/* ── 4 · tilt ──────────────────────────────────
   [data-tilt] leans toward the cursor: --tx / --ty in -1…1, and --lit while it's held. */
function tilts() {
  if (reduce.matches || !fine.matches) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    let raf = 0;
    let x = 0;
    let y = 0;
    let lit = 0;
    const paint = () => {
      raf = 0;
      el.style.setProperty('--tx', x.toFixed(3));
      el.style.setProperty('--ty', y.toFixed(3));
      el.style.setProperty('--lit', String(lit));
    };
    el.addEventListener(
      'pointermove',
      (e) => {
        const r = el.getBoundingClientRect();
        x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
        y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
        lit = 1;
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { passive: true },
    );
    el.addEventListener('pointerleave', () => {
      x = y = lit = 0;
      if (!raf) raf = requestAnimationFrame(paint);
    });
  });
}

/* ── 5 · kinetic letters ───────────────────────
   Inside [data-kinetic], letters marked [data-k="n"] swell toward the cursor along the
   variable font's width axis. The others give way by exactly as much, so the word never
   changes length — it just shifts its weight around, like something breathing.
   Elements sharing an n (the solid masthead and its outline twin) always move together. */
function kinetic() {
  if (reduce.matches || !fine.matches) return;
  const SWELL = 34; // how many width units the favourite letter may gain

  document.querySelectorAll<HTMLElement>('[data-kinetic]').forEach((root) => {
    const groups = new Map<string, HTMLElement[]>();
    root.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
      const key = el.dataset.k ?? '';
      groups.set(key, [...(groups.get(key) ?? []), el]);
    });
    const sets = [...groups.values()];
    if (!sets.length) return;

    // each letter's share of the word, read once at rest (only the ratios matter)
    let share: number[] = [];
    const measure = () => (share = sets.map(([lead]) => lead.getBoundingClientRect().width || 1));
    document.fonts.ready.then(measure);

    let raf = 0;
    let mx = 0;
    let my = 0;
    let inside = false;

    const paint = () => {
      raf = 0;
      if (!share.length) measure();
      const reach = Math.max(240, innerWidth * 0.24);
      const k = sets.map(([lead]) => {
        if (!inside) return 0;
        const r = lead.getBoundingClientRect();
        const d = Math.hypot(mx - (r.left + r.width / 2), (my - (r.top + r.height / 2)) * 0.55);
        const v = clamp(1 - d / reach);
        return v * v * (3 - 2 * v);
      });
      const total = share.reduce((a, b) => a + b, 0);
      const mean = k.reduce((a, v, i) => a + v * share[i], 0) / total;
      sets.forEach((set, i) => {
        const w = (100 + SWELL * (k[i] - mean)).toFixed(1);
        for (const el of set) el.style.setProperty('--w', w);
      });
    };

    root.addEventListener(
      'pointermove',
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        inside = true;
        if (!raf) raf = requestAnimationFrame(paint);
      },
      { passive: true },
    );
    root.addEventListener('pointerleave', () => {
      inside = false;
      if (!raf) raf = requestAnimationFrame(paint);
    });
  });
}

/* ── 6 · where am I ────────────────────────────
   The nav shows the index and name of the poster under the middle of the screen. */
function chapters() {
  const sections = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
  if (!sections.length) return;
  const idx = document.querySelectorAll<HTMLElement>('[data-chapter-idx]');
  const now = document.querySelectorAll<HTMLElement>('[data-chapter-now]');
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a[href*="#"]')];

  const show = (el: HTMLElement) => {
    idx.forEach((n) => (n.textContent = `(${el.dataset.chapter})`));
    now.forEach((n) => (n.textContent = el.dataset.chapterName ?? ''));
    links.forEach((a) => {
      if (a.hash === `#${el.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  const middle = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) show(e.target as HTMLElement);
    },
    { rootMargin: '-45% 0px -54% 0px' },
  );
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-seen');
        seen.unobserve(e.target);
      }
    },
    { threshold: 0.08 },
  );
  sections.forEach((s) => (middle.observe(s), seen.observe(s)));
}

/* ── 7 · jumping ───────────────────────────────
   A key on the keyboard, or a link in the nav, doesn't scroll you past six sections.
   A card in the destination's colours wipes across, the page moves behind it, and the
   card leaves. */
let jumping = false;

export async function jumpTo(hash: string): Promise<boolean> {
  let target: HTMLElement | null = null;
  try {
    target = document.querySelector<HTMLElement>(hash);
  } catch {}
  if (!target) return false;
  const dest = target;

  const land = () => {
    // A jump is a real step in history, so Back returns you to where you jumped from
    // (the keyboard, usually) rather than to the top of the page. The place being left is
    // written into its own entry first; the new entry is pushed before the page moves.
    const here = Math.round(scrollY);
    try {
      history.replaceState({ ...(history.state ?? {}), y: here }, '');
      history.pushState({ y: here }, '', hash);
    } catch {}
    dest.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
    try {
      history.replaceState({ y: Math.round(scrollY) }, '');
    } catch {}
    dest.classList.remove('is-arrived');
    void dest.offsetWidth;
    dest.classList.add('is-arrived', 'is-seen');
    if (!dest.hasAttribute('tabindex')) dest.setAttribute('tabindex', '-1');
    dest.focus({ preventScroll: true });
  };

  const card = document.querySelector<HTMLElement>('[data-jump]');
  if (reduce.matches || !card || !card.animate) {
    land();
    return true;
  }
  if (jumping) return true;
  jumping = true;

  // dress the card as the poster it's taking you to
  const scheme = [...dest.classList].find((c) => c.startsWith('s-')) ?? 's-paper';
  card.className = `jump is-on ${scheme}`;
  card.querySelector('[data-jump-idx]')!.textContent = dest.dataset.chapter ? `(${dest.dataset.chapter})` : '';
  const name = card.querySelector<HTMLElement>('[data-jump-name]')!;
  name.textContent = dest.dataset.chapterName ?? dest.id;

  // Size the word to the screen it's on: measure it once at a known size, then scale so it
  // fills the measure without ever touching the edges, whatever its length.
  const pad = parseFloat(getComputedStyle(card).paddingLeft) || 0;
  name.style.fontSize = '200px';
  const natural = name.getBoundingClientRect().width || 1;
  const fit = (200 * (card.clientWidth - pad * 2)) / natural;
  name.style.fontSize = `${Math.min(fit * 0.98, innerWidth * 0.3, innerHeight * 0.6).toFixed(1)}px`;

  const ease = 'cubic-bezier(0.7, 0, 0.2, 1)';
  const cover = card.animate([{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 430, easing: ease, fill: 'forwards' });
  // the word rises into place from under its own baseline; it never moves sideways
  const rise = name.animate([{ translate: '0 104%' }, { translate: '0 0' }], {
    duration: 560,
    delay: 140,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    fill: 'both',
  });
  await cover.finished.catch(() => undefined);
  land();
  await wait(260);
  const leave = card.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }], { duration: 520, easing: ease, fill: 'forwards' });
  await leave.finished.catch(() => undefined);
  card.classList.remove('is-on');
  [cover, leave, rise].forEach((a) => a.cancel());
  jumping = false;
  return true;
}

function jumps() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.hasAttribute('data-no-jump')) return;
    if (a.origin !== location.origin || a.pathname !== location.pathname || a.hash.length < 2) return;
    // SVG links (the keyboard's keys) run their own choreography first
    if (a.closest('svg')) return;
    if (!document.querySelector(a.hash)) return;
    e.preventDefault();
    void jumpTo(a.hash);
  });
}

/* ── 8 · going back ────────────────────────────
   Back and Forward between jumps put the page exactly where that entry left it,
   at once — not by scrolling the long way round. */
function returns() {
  addEventListener('popstate', (e) => {
    const y = (e.state as { y?: unknown } | null)?.y;
    if (typeof y !== 'number') return;
    const root = document.documentElement;
    root.style.scrollBehavior = 'auto';
    scrollTo(0, y);
    // the browser may restore the position itself a moment later; keep it instant for that too
    requestAnimationFrame(() => requestAnimationFrame(() => (root.style.scrollBehavior = '')));
  });
}

reveals();
returns();
views();
pointers();
tilts();
kinetic();
chapters();
jumps();
