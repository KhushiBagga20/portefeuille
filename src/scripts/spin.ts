// Something round you can spin with a finger. It keeps turning after you let go and
// slows down by itself.
//
// The element gets `--spin` (an angle); whatever is inside decides what turns and how fast.
// With reduced motion it still follows your hand, but doesn't coast.

export function initSpin(el: HTMLElement) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let angle = 0;
  let velocity = 0; // degrees per frame
  let raf = 0;
  let dragging = false;
  let last = 0;
  let lastT = 0;

  const paint = () => el.style.setProperty('--spin', `${angle.toFixed(2)}deg`);

  /** the angle of the pointer as seen from the middle of the element */
  const bearing = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const coast = () => {
    raf = 0;
    if (dragging) return;
    angle += velocity;
    velocity *= 0.968;
    paint();
    if (Math.abs(velocity) > 0.03) raf = requestAnimationFrame(coast);
  };

  /** give it a push, in degrees per frame */
  const push = (v: number) => {
    if (reduce.matches) return;
    velocity = v;
    if (!raf) raf = requestAnimationFrame(coast);
  };

  el.addEventListener('pointerdown', (e) => {
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // a pointer that can't be captured can still be followed while it stays over the flower
    }
    dragging = true;
    velocity = 0;
    last = bearing(e);
    lastT = performance.now();
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const a = bearing(e);
    let d = a - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    angle += d;
    velocity = d * (16.7 / Math.max(4, now - lastT));
    last = a;
    lastT = now;
    paint();
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    push(Math.max(-40, Math.min(40, velocity)));
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  // the first time it's seen, it turns once on its own so you know it can
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      push(7);
    },
    { threshold: 0.6 },
  );
  io.observe(el);
}
