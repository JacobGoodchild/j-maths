export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** requestAnimationFrame loop with dt in seconds (clamped). start/stop are idempotent. */
export function loop(fn) {
  let id = 0, last = 0, running = false;
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    fn(dt, t / 1000);
    if (running) id = requestAnimationFrame(frame);
  };
  return {
    start() { if (running) return; running = true; last = performance.now(); id = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(id); },
    get running() { return running; },
  };
}

/** Coalesce many state changes into one draw per animation frame. */
export function scheduler(fn) {
  let queued = false;
  return () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; fn(); }); };
}
