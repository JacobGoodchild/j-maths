// Page shell: top bar, tabs, stage + side panel per tab, settings cog.
import { h } from './dom.js';
import { initTheme, setTheme, getTheme, SVG_COG } from './theme.js';
import { segmented } from './ui.js';

initTheme();

/**
 * mountSim({ title, tabs: [{ id, label, init(ctx) }] })
 * ctx = { stage, panel, onShow(fn), onHide(fn) } — init runs once, the first time the tab is shown.
 */
export function mountSim({ title, tabs }) {
  document.title = `${title} · j-maths`;
  const app = document.getElementById('app');

  const cogBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Settings', 'aria-label': 'Settings', html: SVG_COG });
  const pop = h('div', { class: 'popover', hidden: true }, h('div', { class: 'lbl' }, 'Theme'));
  segmented(pop, {
    full: true, value: getTheme(),
    options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
    onChange: setTheme,
  });
  const cogWrap = h('div', { class: 'cog-wrap' }, cogBtn, pop);
  cogBtn.addEventListener('click', () => { pop.hidden = !pop.hidden; });
  document.addEventListener('pointerdown', (e) => { if (!cogWrap.contains(e.target)) pop.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.hidden = true; });

  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const top = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '../../', title: 'All simulations' }, 'j-maths'),
    h('div', { class: 'sim-title' }, title),
    tabs.length > 1 ? tabBar : null,
    h('div', { class: 'spacer' }),
    cogWrap);
  const main = h('main', { class: 'main' });
  app.append(top, main);

  const pages = tabs.map((t) => {
    const stage = h('div', { class: 'stage' });
    const panel = h('aside', { class: 'panel' });
    const page = h('section', { class: 'tab-page', hidden: true, role: 'tabpanel' }, stage, panel);
    const btn = h('button', { class: 'tab-btn', type: 'button', role: 'tab', 'aria-selected': 'false' }, t.label);
    btn.addEventListener('click', () => show(t.id));
    tabBar.append(btn);
    main.append(page);
    return { t, stage, panel, page, btn, inited: false, showCbs: [], hideCbs: [] };
  });

  let current = null;
  function show(id, updateHash = true) {
    const next = pages.find((p) => p.t.id === id) || pages[0];
    if (current === next) return;
    if (current) { current.page.hidden = true; current.btn.setAttribute('aria-selected', 'false'); current.hideCbs.forEach((f) => f()); }
    current = next;
    next.page.hidden = false;
    next.btn.setAttribute('aria-selected', 'true');
    if (!next.inited) {
      next.inited = true;
      next.t.init({ stage: next.stage, panel: next.panel, onShow: (f) => next.showCbs.push(f), onHide: (f) => next.hideCbs.push(f) });
    }
    next.showCbs.forEach((f) => f());
    if (updateHash && tabs.length > 1) history.replaceState(null, '', '#' + next.t.id);
  }
  window.addEventListener('hashchange', () => show(location.hash.slice(1), false));
  show(location.hash.slice(1) || tabs[0].id, false);
}
