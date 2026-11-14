// Random numbers and a few distribution helpers (no DOM).

/** sfc32: small, fast, good quality. */
export function makeRng(seed) {
  let a = seed[0] >>> 0, b = seed[1] >>> 0, c = seed[2] >>> 0, d = seed[3] >>> 0;
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
    const r = (t + d) | 0; c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next();
  let spare = null;
  const rng = {
    random: next,
    /** Standard normal by the Box–Muller transform (two draws give two values). */
    normal() {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u = 0; while (u === 0) u = next();
      const v = next(), r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
      spare = r * Math.sin(th);
      return r * Math.cos(th);
    },
    exponential: () => { let u = 0; while (u === 0) u = next(); return -Math.log(u); },
    bernoulli: (p) => (next() < p ? 1 : 0),
    binomial(n, p) { let k = 0; for (let i = 0; i < n; i++) if (next() < p) k++; return k; },
    int: (m) => Math.floor(next() * m),
  };
  return rng;
}
export function seeded() {
  const s = new Uint32Array(4);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(s);
  else for (let i = 0; i < 4; i++) s[i] = (Math.random() * 4294967296) >>> 0;
  return makeRng(s);
}

// ---- exact distributions ----
const LF = [0];
const logFact = (n) => { while (LF.length <= n) LF.push(LF[LF.length - 1] + Math.log(LF.length)); return LF[n]; };
/** P(X = k) for X ~ B(n, p) */
export function binomPmf(n, p, k) {
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(logFact(n) - logFact(k) - logFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
export const normalPdf = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
