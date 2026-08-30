#!/bin/bash
# Genera todos los iconos a partir de favicon.svg.
#   bash tools/iconos.sh .
#
# Tres cosas que cuestan de averiguar y por eso esto es un script:
#   - ImageMagick aqui no tiene delegado librsvg: rasteriza el SVG sin los
#     trazos y devuelve un cuadrado verde vacio. Se usa QuickLook (WebKit).
#   - QuickLook centra el pulgar sobre un lienzo blanco: hay que recortarlo.
#   - El escritor de ICO cuantiza a 2 colores sin -type TrueColorAlpha.
# Al terminar, comprueba con tools/verificar-iconos.py que no salgan vacios.
set -euo pipefail
cd "${1:-.}"
V='#7BE05C'
rm -rf /tmp/ql && mkdir -p /tmp/ql

# A 16 px el circulo y las areas se emborronan: version reducida a bordes
# y linea de medios, con trazo mas grueso.
cat > /tmp/icono-16.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#7BE05C"/>
  <g fill="none" stroke="#0A2810" stroke-width="5.5" stroke-linejoin="round">
    <rect x="8" y="14" width="48" height="36" rx="2"/>
    <path d="M32 14V50"/>
  </g>
</svg>
SVG

# QuickLook (WebKit) rasteriza el SVG; ImageMagick aqui no tiene delegado
# librsvg y descarta los trazos, dejando un cuadrado verde vacio.
qlmanage -t -s 1024 -o /tmp/ql favicon.svg       >/dev/null 2>&1
qlmanage -t -s 1024 -o /tmp/ql /tmp/icono-16.svg >/dev/null 2>&1
FULL=/tmp/ql/favicon.svg.png
SMALL=/tmp/ql/icono-16.svg.png
[ -s "$FULL" ] && [ -s "$SMALL" ] || { echo "QuickLook no genero los maestros"; exit 1; }
# El pulgar viene centrado sobre blanco: se recorta al arte.
magick "$FULL"  -bordercolor white -border 1 -trim +repage "$FULL"
magick "$SMALL" -bordercolor white -border 1 -trim +repage "$SMALL"

R=(-filter Lanczos -resize)
magick "$FULL" "${R[@]}" 180x180 icons/apple-touch-icon.png
magick "$FULL" "${R[@]}" 192x192 icons/icon-192.png
magick "$FULL" "${R[@]}" 512x512 icons/icon-512.png
# Maskable: Android recorta a un circulo del 80%, asi que la marca va al
# 83% y centrada, con el verde llegando hasta el borde.
magick "$FULL" "${R[@]}" 424x424 -background "$V" -gravity center -extent 512x512 \
       icons/icon-maskable-512.png

# -type TrueColorAlpha: sin esto el escritor de ICO cuantiza a 2 colores.
magick "$SMALL" "${R[@]}" 16x16 -type TrueColorAlpha -depth 8 /tmp/f16.png
magick "$SMALL" "${R[@]}" 32x32 -type TrueColorAlpha -depth 8 /tmp/f32.png
magick "$FULL"  "${R[@]}" 48x48 -type TrueColorAlpha -depth 8 /tmp/f48.png
magick /tmp/f16.png /tmp/f32.png /tmp/f48.png -type TrueColorAlpha -depth 8 favicon.ico
