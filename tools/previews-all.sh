#!/bin/sh
# Regenerates every home-page preview image. Run from the repo root.
set -e
node tools/previews.mjs unit-circle both
SCRIPT=tools/preview-maclaurin.mjs node tools/previews.mjs maclaurin
SCRIPT=tools/preview-riemann.mjs node tools/previews.mjs riemann
SCRIPT=tools/preview-dist.mjs node tools/previews.mjs distributions galton
SCRIPT=tools/preview-derivative.mjs node tools/previews.mjs derivative
SCRIPT=tools/preview-matrices.mjs node tools/previews.mjs matrices
SCRIPT=tools/preview-newton.mjs node tools/previews.mjs newton-raphson newton
SCRIPT=tools/preview-volumes.mjs node tools/previews.mjs volumes solid
SCRIPT=tools/preview-complex.mjs node tools/previews.mjs complex arithmetic
