#!/usr/bin/env python3
"""Comprueba que cada icono lleve la marca dibujada y no sea un cuadrado
liso, y que el maskable quepa en el circulo del 80% al que recorta Android.

  python3 tools/verificar-iconos.py favicon.ico icons/*.png
"""
import subprocess, sys, math
def analiza(f, zona_segura=False):
    out = subprocess.run(["magick", f, "-depth", "8", "txt:-"],
                         capture_output=True, text=True).stdout.splitlines()[1:]
    tot = osc = fuera = 0
    w = None
    for l in out:
        pos, rest = l.split(":", 1)
        x, y = map(int, pos.split(","))
        w = max(w or 0, x + 1)
        tot += 1
        # srgba(r,g,b...) -> oscuro si el rojo es bajo y es opaco
        rgb = rest.split("(")[1].split(")")[0].split(",")
        r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
        a = float(rgb[3]) if len(rgb) > 3 else 1
        if r < 80 and a > 0.75:
            osc += 1
            if zona_segura and math.hypot(x - w/2, y - w/2) > w * 0.4:
                fuera += 1
    return tot, osc, fuera
for f in sys.argv[1:]:
    seg = "maskable" in f
    tot, osc, fuera = analiza(f, seg)
    pct = 100.0 * osc / tot
    estado = "ok" if osc > 0 else "SIN MARCA"
    extra = ""
    if seg:
        extra = "  fuera de zona segura: %d" % fuera
        if fuera: estado = "SE RECORTA"
    print("%-32s %6.2f%% marca  %s%s" % (f, pct, estado, extra))
