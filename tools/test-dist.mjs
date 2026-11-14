import { makeRng, binomPmf, normalPdf } from '../assets/js/kit/rng.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t) => Math.abs(a - b) < t;
// binomial pmf equals C(n,r) p^r q^(n-r)
const choose = (n, r) => { let c = 1; for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i; return c; };
for (const [n, p] of [[5, 0.3], [10, 0.5], [20, 0.9], [1, 0.25]]) {
  let s = 0, m = 0;
  for (let r = 0; r <= n; r++) { const e = choose(n, r) * p ** r * (1 - p) ** (n - r); ok(close(binomPmf(n, p, r), e, 1e-12), `pmf ${n} ${p} ${r}`); s += e; m += r * e; }
  ok(close(s, 1, 1e-12) && close(m, n * p, 1e-12), 'pmf sums');
}
// sampler against pmf (chi-square-ish)
const R = makeRng([1, 2, 3, 4]); const n = 10, p = 0.3, N = 200000, c = new Array(n + 1).fill(0);
for (let i = 0; i < N; i++) c[R.binomial(n, p)]++;
for (let r = 0; r <= n; r++) { const e = N * binomPmf(n, p, r); if (e > 50) ok(Math.abs(c[r] - e) < 5 * Math.sqrt(e), `binomial sampler r=${r} ${c[r]} vs ${e}`); }
// normal sampler moments and tail
let s1 = 0, s2 = 0, tail = 0; const M = 400000;
for (let i = 0; i < M; i++) { const z = R.normal(); s1 += z; s2 += z * z; if (Math.abs(z) < 1) tail++; }
ok(close(s1 / M, 0, 0.01), 'normal mean'); ok(close(s2 / M, 1, 0.01), 'normal var'); ok(close(tail / M, 0.6827, 0.004), 'normal 68%');
// pdf integrates to 1
let I = 0; for (let x = -8; x < 8; x += 0.001) I += normalPdf(x, 0, 1) * 0.001; ok(close(I, 1, 1e-4), 'pdf integral');
// CLT: mean of 30 uniforms has sd sqrt(1/12/30)
let m1 = 0, m2 = 0; const T = 50000; for (let i = 0; i < T; i++) { let s = 0; for (let j = 0; j < 30; j++) s += R.random(); s /= 30; m1 += s; m2 += s * s; }
const sd = Math.sqrt(m2 / T - (m1 / T) ** 2); ok(close(sd, Math.sqrt(1 / 12 / 30), 0.001), `clt sd ${sd}`);
console.log(fails ? fails + ' failures' : 'all distribution tests passed');
