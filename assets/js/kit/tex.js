import katex from '../../vendor/katex/katex.mjs';

export function renderTex(el, src, display = false) {
  katex.render(src, el, { displayMode: display, throwOnError: false, output: 'html' });
  return el;
}
export function texString(src, display = false) {
  return katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html' });
}
/** Render text containing inline $...$ maths into el. */
export function renderRich(el, str) {
  el.textContent = '';
  const parts = String(str).split('$');
  parts.forEach((p, i) => {
    if (i % 2 === 1) { const s = document.createElement('span'); renderTex(s, p); el.append(s); }
    else if (p) el.append(document.createTextNode(p));
  });
  return el;
}
