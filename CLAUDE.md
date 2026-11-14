# j-maths — working notes

## Status
- Built: all eight sims from the brief (see below), plus shared kit and home page.
- Next: polish pass (see Ask Jacob and the polish list at the bottom).

## Layout
- `index.html` home grid, driven by `assets/js/registry.js`.
- `sims/<id>/index.html` + `main.js` per sim. Everything is relative-pathed for GitHub Pages in a subfolder.
- `assets/css/kit.css` all styling (theme tokens at top). `assets/js/kit/*` the shared kit:
  `shell.js` (page, tabs, cog), `ui.js` (slider, toggle, segmented, dropdown, readouts, transport),
  `plot.js` (canvas graph helper), `theme.js`, `tex.js` (KaTeX), `anim.js`.
- `assets/vendor/` local copies of KaTeX, three.js (+OrbitControls), and the fonts live in `assets/fonts/`.
- `tools/shot.mjs` screenshots a sim in light + dark and lists console errors. `tools/previews.mjs` makes home-page thumbnails.
  Run from repo root: `node tools/shot.mjs sims/unit-circle tab1,tab2` (images land in /tmp/claude-0/shots/).

## Decisions
- No build step. ES modules, KaTeX via its `.mjs`.
- Fonts: Instrument Sans (UI) + Newsreader (titles). Bundled locally.
- Colours are CSS variables; canvas code reads them through `colors()` so both themes match. Semantic roles:
  fn (blue), approx (orange), error (pink-red), tangent (green), area/angle (violet), aux (teal). sin/cos/tan have their own vars.
- Unit circle: the circle and its graph share one vertical scale so the dashed link line is continuous across two canvases.

## Ask Jacob
