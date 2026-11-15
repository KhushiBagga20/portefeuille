// The reading page (pages/playground/writing/[slug].astro): the reader's own settings —
// page colour, typeface, text size — a focus mode that clears everything but the text,
// and a hairline showing how far through the piece they are.
//
// The settings are the reader's, so they are remembered on this device and applied before
// the page paints (the small inline script in the page does that part).

type Settings = { theme: string; face: string; size: number };
const KEY = 'khushi:reading';
const SIZES = [0.9, 1, 1.12, 1.26];

export function initReading(page: HTMLElement) {
  const root = document.documentElement;
  const read = (): Settings => {
    try {
      return { theme: 'paper', face: 'sans', size: 1, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    } catch {
      return { theme: 'paper', face: 'sans', size: 1 };
    }
  };
  let s = read();

  const apply = (save = true) => {
    page.dataset.theme = s.theme;
    page.dataset.face = s.face;
    page.style.setProperty('--scale', String(SIZES[s.size] ?? 1));
    page.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(s[b.dataset.set as 'theme' | 'face'] === b.dataset.value)));
    page.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) => (b.disabled = Number(b.dataset.size) < 0 ? s.size <= 0 : s.size >= SIZES.length - 1));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(page).backgroundColor);
    if (!save) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  };

  page.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) =>
    b.addEventListener('click', () => {
      s = { ...s, [b.dataset.set!]: b.dataset.value! };
      apply();
    }),
  );
  page.querySelectorAll<HTMLButtonElement>('[data-size]').forEach((b) =>
    b.addEventListener('click', () => {
      s = { ...s, size: Math.min(SIZES.length - 1, Math.max(0, s.size + Number(b.dataset.size))) };
      apply();
    }),
  );
  apply(false);

  // ── focus mode: nothing on screen but the piece ──
  const focusButtons = [...page.querySelectorAll<HTMLButtonElement>('[data-focus]')];
  const setFocus = (on: boolean) => {
    // keep the reader's place: the bar above the text is about to appear or disappear
    const anchor = page.querySelector<HTMLElement>('[data-text]');
    const before = anchor?.getBoundingClientRect().top ?? 0;
    root.classList.toggle('is-reading', on);
    focusButtons.forEach((b) => b.setAttribute('aria-pressed', String(on)));
    const after = anchor?.getBoundingClientRect().top ?? 0;
    scrollBy({ top: after - before, behavior: 'instant' as ScrollBehavior });
  };
  focusButtons.forEach((b) => b.addEventListener('click', () => setFocus(!root.classList.contains('is-reading'))));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-reading')) setFocus(false);
  });
  // leaving the page must not leave the next one in focus mode
  addEventListener('pagehide', () => root.classList.remove('is-reading'));

  // ── how far through ──
  const bar = page.querySelector<HTMLElement>('[data-progress]');
  const text = page.querySelector<HTMLElement>('[data-text]');
  if (bar && text) {
    let queued = false;
    const paint = () => {
      queued = false;
      const r = text.getBoundingClientRect();
      const total = r.height - innerHeight * 0.6;
      const done = total > 0 ? Math.min(1, Math.max(0, (innerHeight * 0.4 - r.top) / total)) : r.top < innerHeight ? 1 : 0;
      bar.style.setProperty('--done', done.toFixed(4));
    };
    addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
      },
      { passive: true },
    );
    addEventListener('resize', paint);
    paint();
  }
}
