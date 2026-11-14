import { FUNCS, integrate } from '../assets/js/kit/funcs.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const close = (a, b, t = 1e-7) => Math.abs(a - b) < t * Math.max(1, Math.abs(b));
const PI = Math.PI, f = FUNCS.x2;
ok(close(PI * integrate((x) => f.f(x) ** 2, 0, 2, 200), (32 * PI) / 5), 'x^2 about x-axis = 32pi/5');
ok(close(PI * integrate((x) => x * x * Math.abs(f.df(x)), 0, 2, 200), 8 * PI), 'x^2 about y-axis = 8pi');
ok(close(PI * integrate((x) => FUNCS.sqrt.f(x) ** 2, 0, 4, 400), 8 * PI, 1e-6), 'sqrt x about x-axis = 8pi');
ok(close(PI * integrate((x) => FUNCS.sin.f(x) ** 2, 0, PI, 200), (PI * PI) / 2), 'sin about x = pi^2/2');
ok(close(PI * integrate((x) => 3 ** 2 - x ** 4, 0, Math.sqrt(3), 200), PI * (9 * Math.sqrt(3) - 9 * Math.sqrt(3) / 5)), 'washer y=3, y=x^2');
// midpoint disc sums converge
const sum = (N) => { const h = 4 / N; let s = 0; for (let k = 0; k < N; k++) { const m = (k + 0.5) * h; s += PI * m * h; } return s; };
ok(Math.abs(sum(60) - 8 * PI) < 0.01 * 8 * PI && Math.abs(sum(1000) - 8 * PI) < 1e-4, 'disc sums converge');
console.log(fails ? fails + ' failures' : 'all volume tests passed');
