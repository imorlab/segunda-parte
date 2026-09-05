#!/bin/bash
# Sube la version de cache en index.html y en el service worker a la vez.
# Olvidarse de esto hace que el navegador siga sirviendo el fichero viejo
# y el cambio parezca no haberse aplicado. Ya ha pasado tres veces.
#   bash tools/version.sh 24
set -euo pipefail
n="${1:?uso: bash tools/version.sh <numero>}"
cd "$(dirname "$0")/.."
viejo=$(grep -o '?v=[0-9]*' index.html | head -1 | cut -d= -f2)
sed -i '' "s/?v=$viejo/?v=$n/g" index.html
sed -i '' "s/var VERSION = \"sp-[0-9]*\";/var VERSION = \"sp-$n\";/" sw.js
echo "v=$viejo -> v=$n  ($(grep -c "?v=$n" index.html) referencias en index.html)"
grep -o 'var VERSION = "[^"]*"' sw.js
