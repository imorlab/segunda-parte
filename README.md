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
- **Navegación inferior** de cuatro destinos, al alcance del pulgar y respetando el
  indicador de inicio del iPhone: Entreno (Día 1 / Día 2), Historial, Movilidad y Perfil
  (Progreso / Semana). La portada solo aparece en Entreno; el resto usa cabecera compacta.
- **Historial con calendario**: los días con entreno llevan punto; al tocar uno se ven las
  sesiones de ese día con sus series, pesos, volumen y XP.
- **Interruptor de partido** en la cabecera: recalcula ejercicios, avisos y la semana.
- **Sustitutos** por ejercicio (3 por ficha) con sus propias claves técnicas y su vídeo.
  La elección se recuerda por nombre, no por posición: la eliges una vez.
  Cada serie guarda el movimiento que hiciste de verdad, y las marcas se agrupan por
  movimiento, no por hueco del plan — un rack pull mueve mucho más peso que un trap
  bar por tener menos recorrido, y compararlos daría un récord falso.
- **Calentamiento de gimnasio** en los dos días: unos minutos suaves, movilidad rápida y
  series de aproximación en el primer ejercicio. No confundir con el calentamiento
  *antes del partido*, que está en el Día 2 y es para la pista.
- **Registro por serie**: peso y repeticiones, prerrellenados con lo de la vez anterior,
  y encima la línea **Última vez** con la sesión anterior completa de ese mismo movimiento,
  para ver si aguantaste el peso hasta la última serie o se te cayó.
- **Cronómetro** que arranca solo al marcar una serie: 2 min en los básicos pesados
  (peso muerto, press inclinado, prensa, press de hombros y RDL) y 90 s en el resto.
  Presets manuales de 1:00 / 1:30 / 2:00.
- **Semana** que se recoloca según el día de referencia.
- **Tres temas**: Grafito, Claro y Vino, en el icono de la esquina superior derecha.

## El juego

Todo se calcula a partir de las series registradas, nunca de contadores guardados,
así que el marcador no puede desincronizarse.

| Qué                        | XP         |
| -------------------------- | ---------- |
| Serie completada           | 10         |
| Sesión completa            | 50         |
| Batir tu marca (récord)    | 100        |
| Logro común / raro / épico | 75/150/300 |

Los 12 logros tienen rareza, y cada recompensa se ve y se siente distinta: color propio,
etiqueta y patrón de vibración. Una serie suelta lanza un **+10 XP** desde el propio botón;
subir de nivel para la pantalla con confeti, porque es lo más raro que pasa en el juego.

Una sesión cuenta al llegar al **70%** de sus series. Exigir el 100% hacía que saltarte
un ejercicio porque la máquina estaba ocupada te costara la racha, y que añadir ejercicios
al plan invalidara sesiones ya hechas.

Nueve niveles, de *Suplente* a *Leyenda*. La curva está calculada sobre unos 500-800 XP
semanales: los primeros caen pronto para enganchar y Leyenda queda a año y medio de
constancia real. La **racha** cuenta semanas seguidas con las
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
js/respaldo.js    Exportar e importar el historial
tools/            Iconos, servidor Supabase falso y pruebas de datos
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

### Reglas de la capa de datos

Cada una está escrita después de perder datos de verdad:

1. **Los ids son deterministas**, derivados de la clave natural de la fila. Dos
   dispositivos, o el mismo tras perder la caché, generan el mismo id para el mismo
   hecho físico. Sin esto, un upsert por clave natural intenta reescribir la clave
   primaria de la sesión y la clave ajena de `serie` lo rechaza: el día entero se queda
   atascado en la cola.
2. **Sincronizar nunca borra.** Lo local que no esté arriba se conserva y se reencola.
   Una cola vacía no demuestra que nada quede por subir.
3. **Nada falla en silencio.** Disco lleno, fila rechazada o sincronización caída se ven
   en el panel de Cuenta.
4. **Se reconcilia por clave natural, no por id**, para que una divergencia de ids no
   duplique series ni infle el XP.
5. **Los borrados dejan tumba**, o la fusión con el disco y la siguiente descarga
   resucitan la serie borrada. No caducan por tiempo (olvidarlas la resucita); se acotan
   por número. Restaurar un respaldo las levanta.

Además: la cola aparta las filas que Postgres rechazaría siempre en vez de atascarse con
ellas, la descarga va paginada (PostgREST corta en 1000 filas), y un recuento parcial
nunca puede degradar una sesión ya dada por completada.

```bash
node tools/prueba-sincronizacion.js   # 12 escenarios que costaron datos
```

El servidor falso de `tools/supabase-falso.js` respeta claves únicas y ajenas, columnas
generadas, RLS y el orden inestable del paginado, y devuelve copias: si el cliente manda
algo que Postgres rechazaría, aquí falla igual.

### iOS: web app en la pantalla de inicio

Es el modo en que se usa, y tiene dos trampas de plataforma:

- **La web app tiene su propio contenedor de almacenamiento, separado de Safari**
  ([WebKit #181849](https://bugs.webkit.org/show_bug.cgi?id=181849), es por diseño). Por
  eso el acceso es con **correo y contraseña**: cualquier login por enlace crea la sesión
  en Safari, donde la web app no la ve nunca. Requiere *Confirm email* desactivado en
  Supabase (Authentication → Sign In / Providers → Email), o el registro se queda
  esperando un correo de confirmación que vuelve a abrirse en Safari.
- **iOS puede desalojar el origen entero** por falta de espacio, y se va todo de golpe.
  La app pide `navigator.storage.persist()` tras el primer gesto — WebKit usa como
  heurística que la app esté instalada, así que es el caso favorable — pero no es una
  garantía. De ahí la copia manual.

Para que el historial te siga entre el móvil y el ordenador:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Pega `sql/schema.sql` en el **SQL Editor** y ejecútalo. Crea las tablas, las políticas
   RLS y las vistas.
3. En **Project Settings → API** copia la *URL* y la clave *anon* a `config.js`.
4. En **Authentication → Sign In / Providers → Email**, desactiva *Confirm email*. Sin
   eso el registro exige confirmar por correo, y ese enlace se abre en Safari, que en iOS
   es otro contenedor: la sesión se crearía donde la app no la ve.
5. Entra desde la pestaña **Progreso** con tu correo y una contraseña.

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
