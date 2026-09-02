# segunda-parte

Plan de entrenamiento en dos sesiones semanales, compatible con jugar al fútbol sala,
convertido en un juego de progresión: registras cada serie y eso alimenta XP, niveles,
rachas, récords y logros.

**En vivo:** https://imorlab.github.io/segunda-parte/

Sin build ni framework: HTML y JavaScript plano servidos tal cual desde GitHub Pages.
Supabase, opcional, guarda el historial y lo sincroniza entre dispositivos.

## Qué hace

- **Día 1** — fuerza completa (peso muerto, prensa, empujes, tirones y hombro), RIR 2–3.
- **Día 2** — cambia según la semana:
  - *Hay partido*: tren superior y core. Nada de piernas pesadas antes de jugar.
  - *Sin partido*: entra bisagra de cadera, trabajo unilateral y 8–10 min de cardio.
- **Interruptor de partido** en la cabecera: recalcula ejercicios, avisos y la semana.
- **Sustitutos** por ejercicio (3 por ficha) con sus propias claves técnicas y su vídeo.
  La elección se recuerda por nombre, no por posición: la eliges una vez.
  Cada serie guarda el movimiento que hiciste de verdad, y las marcas se agrupan por
  movimiento, no por hueco del plan — un rack pull mueve mucho más peso que un trap
  bar por tener menos recorrido, y compararlos daría un récord falso.
- **Calentamiento de gimnasio** en los dos días: unos minutos suaves, movilidad rápida y
  series de aproximación en el primer ejercicio. No confundir con el calentamiento
  *antes del partido*, que está en el Día 2 y es para la pista.
- **Registro por serie**: peso y repeticiones, prerrellenados con lo de la vez anterior.
- **Cronómetro** que arranca solo al marcar una serie: 2 min en los básicos pesados
  (peso muerto, press inclinado, prensa, press de hombros y RDL) y 90 s en el resto.
  Presets manuales de 1:00 / 1:30 / 2:00.
- **Semana** que se recoloca según el día de referencia.
- **Tres temas**: Grafito, Claro y Vino, en el icono de la esquina superior derecha.

## El juego

Todo se calcula a partir de las series registradas, nunca de contadores guardados,
así que el marcador no puede desincronizarse.

| Qué                        | XP   |
| -------------------------- | ---- |
| Serie completada           | 10   |
| Sesión completa            | 50   |
| Batir tu marca (récord)    | 100  |
| Logro desbloqueado         | 75   |

Ocho niveles, de *Suplente* a *Leyenda*. La **racha** cuenta semanas seguidas con las
dos sesiones hechas; la semana en curso no la rompe hasta que termina. Los **récords**
se miden en 1RM estimado (fórmula de Epley), que permite comparar 60 kg × 8 con
70 kg × 4. Hay 12 **logros**.

## Estructura

```
index.html        Marcado y estilos
config.js         Claves de Supabase (opcional)
js/datos.js       Ejercicios, rutinas, calentamientos y movilidad. Solo contenido
js/juego.js       Reglas: XP, niveles, rachas, récords, logros. Funciones puras
js/nube.js        Cache local + sincronización con Supabase
js/app.js         Interfaz
sql/schema.sql    Esquema de la base de datos
favicon.svg       Origen del icono; el resto se genera a partir de él
tools/            Generación y verificación de los iconos
```

## Iconos

El icono es el campo de fútbol sala de la cabecera. Va cuadrado y a sangre a
propósito: iOS y Android aplican su propia máscara redondeada, y redondearlo en
el origen deja esquinas dobles. A 16 y 32 px se usa una versión reducida a
bordes y línea de medios, porque el círculo central y las áreas se emborronan.

Para regenerarlos tras tocar `favicon.svg`:

```bash
bash tools/iconos.sh . && python3 tools/verificar-iconos.py favicon.ico icons/*.png
```

Merece la pena verificar: en este equipo ImageMagick no tiene delegado librsvg y
rasteriza el SVG **sin los trazos**, produciendo cuadrados verdes vacíos que
pasan cualquier comprobación de tamaño. El script rasteriza con QuickLook y el
verificador cuenta píxeles de la marca.

## Datos

Funciona sin configurar nada: todo se guarda en el navegador. Cada serie se escribe en
`localStorage` al instante y se encola para subir, así que en un gimnasio sin cobertura
no se pierde nada y se sincroniza al salir.

Para que el historial te siga entre el móvil y el ordenador:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Pega `sql/schema.sql` en el **SQL Editor** y ejecútalo. Crea las tablas, las políticas
   RLS y las vistas.
3. En **Project Settings → API** copia la *URL* y la clave *anon* a `config.js`.
4. En **Authentication → URL Configuration**:
   - *Site URL* → `https://imorlab.github.io/segunda-parte/`
   - *Redirect URLs* → `https://imorlab.github.io/segunda-parte/` y `http://localhost:4173/**`

   Los dos, no solo el segundo. El *Site URL* es el destino de reserva: si el enlace de
   acceso pide una dirección que no está en la lista blanca, Supabase lo manda ahí, y por
   defecto vale `http://localhost:3000` — con lo que el enlace acaba en un
   `ERR_CONNECTION_REFUSED` en lugar de en la app.
5. Entra desde la pestaña **Progreso** con tu correo. Recibes un enlace, sin contraseña.

La clave *anon* es pública por diseño y puede vivir en el repositorio: solo permite lo
que dejen las políticas RLS, que limitan cada fila a su dueño.

## Desarrollo

`localStorage` no funciona abriendo el fichero con `file://`, así que conviene servirlo:

```bash
python3 -m http.server 4173
```

Al desplegar un cambio en cualquier `.js`, sube el `?v=N` de los `<script>` de
`index.html`. GitHub Pages los sirve con `max-age=600` y sin eso el navegador
seguiría usando la versión anterior hasta diez minutos.

## Vídeos

Cada ficha abre una búsqueda filtrada en YouTube. No hay IDs fijados en el código a
propósito: los vídeos de terceros desaparecen y una ficha con "vídeo no disponible"
es peor que un botón de búsqueda.

## Licencia

Uso personal.
