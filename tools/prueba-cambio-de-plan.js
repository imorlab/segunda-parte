#!/usr/bin/env node
/* ¿Sobrevive el historial a un cambio de plan?
 *
 *   node tools/prueba-cambio-de-plan.js
 *
 * Cambiar ejercicios, series o el orden de un día NO debe tocar nada de lo
 * ya entrenado. Se simula un historial guardado con el plan anterior y se
 * comprueba que XP, nivel, racha, volumen y marcas salen idénticos, y que
 * ningún ejercicio del historial se ha quedado sin nombre al salir del
 * plan: EX tiene que conservarlo aunque PLAN ya no lo use. */
var fs = require("fs");
function cargarJuego(){ var g = {}; (function(){ eval(fs.readFileSync("js/juego.js","utf8")); g.Juego = Juego; })(); return g.Juego; }
var Juego = cargarJuego();

// Historial como el que ya existe en el dispositivo: dos semanas reales.
var sesiones = [], series = [];
var dias = [["2026-09-07","d1",19],["2026-09-10","d2",15],["2026-09-14","d1",19],["2026-09-17","d2",15]];
dias.forEach(function(d, i){
  var id = "ses" + i;
  sesiones.push({id:id, usuario:"u", fecha:d[0], dia:d[1], modo:"conPartido",
                 series_plan:d[2], completada:true});
  // ejercicios con su slot tal y como estaban en el plan VIEJO
  var plan = d[1] === "d1" ? [["01",0,3],["02",1,3],["03",2,3],["04",3,3],["05",4,2],["12",5,3],["08",6,2]]
                           : [["06",0,3],["05",1,3],["02",2,3],["03",3,2],["07",4,2],["08",5,2]];
  plan.forEach(function(p){
    for(var n = 1; n <= p[2]; n++) series.push({
      id:"s" + i + "-" + p[0] + "-" + n, usuario:"u", sesion:id,
      ejercicio:p[0], slot:p[1], n_serie:n, variante:null,
      peso:40 + i * 2.5, reps:8, hecha_en:d[0] + "T18:0" + n + ":00.000Z"});
  });
});
var estado = {sesiones:sesiones, series:series, logros:[{clave:"debut", fecha:"2026-09-07"}]};

function foto(){
  return {
    sesiones: estado.sesiones.length,
    completadas: estado.sesiones.filter(function(s){ return s.completada; }).length,
    series: estado.series.length,
    xp: Juego.xp(estado),
    nivel: Juego.nivel(Juego.xp(estado)).n,
    racha: JSON.stringify(Juego.racha(estado.sesiones, "2026-09-21")),
    volumen: Math.round(Juego.volumen(estado.series)),
    marcas: Object.keys(Juego.records(estado.series)).sort().join(","),
    recordsBatidos: Juego.recordsBatidos(estado.series)
  };
}

var antes = foto();
// Aqui es donde "cambia el plan": se recarga datos.js, que es lo unico que se toca.
eval(fs.readFileSync("js/datos.js","utf8"));
var despues = foto();

var fallos = 0;
Object.keys(antes).forEach(function(k){
  var ok = String(antes[k]) === String(despues[k]);
  if(!ok) fallos++;
  console.log((ok ? "  ok    " : "  FALLO ") + k.padEnd(16) + antes[k] + (ok ? "" : "  ->  " + despues[k]));
});

// Y que el plan nuevo no rompa lo que la app necesita leer de el
var problemas = [];
["conPartido","sinPartido"].forEach(function(m){
  ["d1","d2"].forEach(function(d){
    PLAN[m][d].forEach(function(p, i){
      if(!EX[p.id]) problemas.push(m + "." + d + ": ejercicio " + p.id + " no existe en EX");
      if(typeof p.sets !== "number") problemas.push(m + "." + d + "[" + i + "]: sets no es numero");
      if(!p.reps) problemas.push(m + "." + d + "[" + i + "]: sin reps");
    });
  });
});
// Todo ejercicio del historial debe seguir teniendo nombre que mostrar
estado.series.forEach(function(x){
  if(!EX[x.ejercicio]) problemas.push("el historial usa el ejercicio " + x.ejercicio + " y ya no existe");
});
problemas = problemas.filter(function(v, i, a){ return a.indexOf(v) === i; });
problemas.forEach(function(p){ console.log("  FALLO " + p); fallos++; });

console.log(fallos ? "\n" + fallos + " FALLOS\n" : "\nEl historial sobrevive intacto al cambio de plan\n");
process.exit(fallos ? 1 : 0);
