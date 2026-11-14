#!/bin/sh
# Runs every pure-maths test. Usage: sh tools/test-all.sh
for f in tools/test-*.mjs; do node "$f" || exit 1; done
