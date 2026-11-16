// Pure maths for the diffusion sim (no DOM), any number of dimensions.
// Data = equal mixture of small Gaussians (width s) at the given centres, so every noisy
// density p_t and its score are known exactly. No trained network is needed.

// ---- discrete DDPM schedule: x_n = sqrt(alpha_n) x_{n-1} + sqrt(beta_n) eps ----
export function ddpmSchedule(N = 1000, b1 = 1e-4, bN = 0.02) {
  const beta = [0], alpha = [1], abar = [1];
  for (let n = 1; n <= N; n++) { const b = b1 + ((bN - b1) * (n - 1)) / (N - 1); beta.push(b); alpha.push(1 - b); abar.push(abar[n - 1] * (1 - b)); }
  return { N, beta, alpha, abar };
}

// ---- continuous time (variance preserving SDE): dx = -1/2 beta(t) x dt + sqrt(beta(t)) dW ----
export const BMIN = 0.1, BMAX = 20;
export const beta = (t) => BMIN + t * (BMAX - BMIN);
/** alpha-bar(t) = exp(-integral of beta): the fraction of the original signal's variance that is left */
export const alphaBar = (t) => Math.exp(-(BMIN * t + 0.5 * (BMAX - BMIN) * t * t));
/** log signal-to-noise ratio */
export const logSNR = (t) => { const a = alphaBar(t); return Math.log(a / (1 - a)); };

/** Score = gradient of log p_t at x. centres: flat Float64Array (K*d). Writes into out, returns log p_t (up to a constant). */
export function score(x, t, centres, d, s, out) {
  const a = alphaBar(t), ra = Math.sqrt(a), v = a * s * s + (1 - a), K = centres.length / d;
  let best = -Infinity;
  const lw = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    let q = 0;
    for (let j = 0; j < d; j++) { const e = x[j] - ra * centres[k * d + j]; q += e * e; }
    lw[k] = -q / (2 * v); if (lw[k] > best) best = lw[k];
  }
  let W = 0; for (let k = 0; k < K; k++) { lw[k] = Math.exp(lw[k] - best); W += lw[k]; }
  for (let j = 0; j < d; j++) out[j] = 0;
  for (let k = 0; k < K; k++) { const w = lw[k] / W; if (w < 1e-12) continue; for (let j = 0; j < d; j++) out[j] += (w * (ra * centres[k * d + j] - x[j])) / v; }
  return best + Math.log(W / K) - (d / 2) * Math.log(2 * Math.PI * v);
}

/** Best guess of the clean point from a noisy one (Tweedie): x0 = (x + (1 - abar) score) / sqrt(abar) */
export function denoise(x, t, sc, out) {
  const a = alphaBar(t), ra = Math.sqrt(a);
  for (let j = 0; j < x.length; j++) out[j] = (x[j] + (1 - a) * sc[j]) / ra;
  return out;
}

/**
 * One backwards step of size h from time t (to t - h), in place.
 * mode 'sde': dx = [-1/2 beta x - beta score] dt + sqrt(beta) dW   (fresh noise each step)
 * mode 'ode': dx = [-1/2 beta x - 1/2 beta score] dt               (no randomness)
 */
export function reverseStep(x, t, h, centres, d, s, mode, rng, tmp) {
  score(x, t, centres, d, s, tmp);
  const b = beta(t), g = mode === 'sde' ? 1 : 0.5, sd = mode === 'sde' ? Math.sqrt(b * h) : 0;
  for (let j = 0; j < d; j++) x[j] += h * (0.5 * b * x[j] + g * b * tmp[j]) + (sd ? sd * rng.normal() : 0);
}

/** Forward noising in one jump: x_t = sqrt(abar) x_0 + sqrt(1 - abar) eps */
export function noised(x0, eps, t, out) {
  const a = alphaBar(t), ra = Math.sqrt(a), rn = Math.sqrt(1 - a);
  for (let j = 0; j < x0.length; j++) out[j] = ra * x0[j] + rn * eps[j];
  return out;
}

// ---- shapes ----
const TAU = 2 * Math.PI;
export const SHAPES2 = {
  spiral: { label: 'Spiral', f: (u) => { const a = 1.2 + u * 9.5, r = 0.22 + 0.16 * a; return [r * Math.cos(a) * 0.95, r * Math.sin(a) * 0.95]; } },
  moons: { label: 'Two moons', f: (u) => (u < 0.5 ? [Math.cos(u * TAU) * 1.2 - 0.6, Math.sin(u * TAU) * 1.2 - 0.3] : [0.6 - Math.cos((u - 0.5) * TAU) * 1.2, 0.3 - Math.sin((u - 0.5) * TAU) * 1.2]) },
  rings: { label: 'Two rings', f: (u) => (u < 0.36 ? [0.7 * Math.cos(u * TAU / 0.36), 0.7 * Math.sin(u * TAU / 0.36)] : [1.7 * Math.cos((u - 0.36) * TAU / 0.64), 1.7 * Math.sin((u - 0.36) * TAU / 0.64)]) },
  smile: { label: 'Smiley', f: (u) => {
    if (u < 0.5) { const a = (u / 0.5) * TAU; return [1.7 * Math.cos(a), 1.7 * Math.sin(a)]; }
    if (u < 0.62) { const a = ((u - 0.5) / 0.12) * TAU; return [-0.65 + 0.2 * Math.cos(a), 0.6 + 0.2 * Math.sin(a)]; }
    if (u < 0.74) { const a = ((u - 0.62) / 0.12) * TAU; return [0.65 + 0.2 * Math.cos(a), 0.6 + 0.2 * Math.sin(a)]; }
    const a = Math.PI * (1.2 + ((u - 0.74) / 0.26) * 0.6); return [1.05 * Math.cos(a), 1.05 * Math.sin(a) + 0.1];
  } },
  blobs: { label: 'Three clusters', f: (u) => { const k = Math.min(2, Math.floor(u * 3)), a = (k * TAU) / 3 + 0.5, w = (u * 3 - k) * TAU; return [1.3 * Math.cos(a) + 0.12 * Math.cos(w), 1.3 * Math.sin(a) + 0.12 * Math.sin(w)]; } },
};
export const SHAPES3 = {
  knot: { label: 'Trefoil knot', f: (u) => { const a = u * TAU; return [0.55 * (Math.sin(a) + 2 * Math.sin(2 * a)), 0.55 * (Math.cos(a) - 2 * Math.cos(2 * a)), -0.75 * Math.sin(3 * a)]; } },
  helix: { label: 'Double helix', f: (u) => { const two = u < 0.5 ? 0 : Math.PI, v = (u % 0.5) * 2, a = v * TAU * 2.5; return [1.1 * Math.cos(a + two), 1.1 * Math.sin(a + two), (v - 0.5) * 3.4]; } },
  sphere: { label: 'Sphere', f: (u, i, K) => { const z = 1 - (2 * (i + 0.5)) / K, r = Math.sqrt(1 - z * z), a = i * 2.399963; return [1.6 * r * Math.cos(a), 1.6 * r * Math.sin(a), 1.6 * z]; } },
  torus: { label: 'Torus', f: (u, i) => { const a = u * TAU, b = i * 2.399963 * 3; return [(1.35 + 0.5 * Math.cos(b)) * Math.cos(a), (1.35 + 0.5 * Math.cos(b)) * Math.sin(a), 0.5 * Math.sin(b)]; } },
  rings: { label: 'Linked rings', f: (u) => { const a = u * 2 * TAU; return u < 0.5 ? [1.2 * Math.cos(a) - 0.6, 1.2 * Math.sin(a), 0] : [1.2 * Math.cos(a) + 0.6, 0, 1.2 * Math.sin(a)]; } },
};
/** K centres along a shape, as a flat array */
export function centresOf(shape, K, d) {
  const out = new Float64Array(K * d);
  for (let i = 0; i < K; i++) { const p = shape.f((i + 0.5) / K, i, K); for (let j = 0; j < d; j++) out[i * d + j] = p[j]; }
  return out;
}

/**
 * One DDIM step from time t to an earlier time s (the first-order DPM-Solver), in place, no randomness.
 * Predict the noise, use it to guess the clean point, then re-noise that guess to the level of time s:
 * eps = -sqrt(1 - abar_t) score,  x0 = (x - sqrt(1 - abar_t) eps) / sqrt(abar_t),  x_s = sqrt(abar_s) x0 + sqrt(1 - abar_s) eps
 */
export function ddimStep(x, t, s, centres, d, sw, tmp) {
  score(x, t, centres, d, sw, tmp);
  const at = alphaBar(t), as = alphaBar(s), st = Math.sqrt(1 - at), ss = Math.sqrt(1 - as);
  for (let j = 0; j < d; j++) { const eps = -st * tmp[j], x0 = (x[j] - st * eps) / Math.sqrt(at); x[j] = Math.sqrt(as) * x0 + ss * eps; }
}
/** One forward (noising) Euler–Maruyama step of size h from time t: dx = -1/2 beta x dt + sqrt(beta) dW */
export function forwardStep(x, t, h, rng) {
  const b = beta(t), sd = Math.sqrt(b * h);
  for (let j = 0; j < x.length; j++) x[j] += -0.5 * b * x[j] * h + sd * rng.normal();
}
/** The time at which the log-SNR equals l (inverse of logSNR) */
export function tOfLogSNR(l) {
  const c = Math.log(1 + Math.exp(-l)), a = 0.5 * (BMAX - BMIN);   // -ln(abar) = BMIN t + a t^2
  return (-BMIN + Math.sqrt(BMIN * BMIN + 4 * a * c)) / (2 * a);
}
/** n+1 times from t = 1 down to tEnd, evenly spaced in t ('time') or in log-SNR ('snr': the DPM-Solver clock) */
export function timeGrid(n, kind = 'time', tEnd = 1e-3) {
  const out = [];
  if (kind === 'snr') { const l1 = logSNR(1), l0 = logSNR(tEnd); for (let k = 0; k <= n; k++) out.push(k === 0 ? 1 : k === n ? tEnd : tOfLogSNR(l1 + ((l0 - l1) * k) / n)); }
  else for (let k = 0; k <= n; k++) out.push(1 - ((1 - tEnd) * k) / n);
  return out;
}
