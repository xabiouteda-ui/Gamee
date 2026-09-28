#!/usr/bin/env bash
# Ejecuta todas las pruebas y se detiene en el primer fallo.
#   npm i --no-save playwright mediabunny@1.60.0 axe-core && bash tests/run-all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node build.mjs
node tests/check-site.mjs
node tests/unit-captions.mjs
node tests/unit-luz.mjs
node tests/unit-monetizacion.mjs
node tests/e2e.cjs
node tests/e2e-captions.cjs
node tests/e2e-luz.cjs
node tests/e2e-a11y.cjs
echo "✓ Todas las pruebas han pasado."
