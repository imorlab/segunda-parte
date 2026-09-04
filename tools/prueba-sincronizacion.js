#!/usr/bin/env node
/* Pruebas de regresion de la capa de datos.
 *
 *   node tools/prueba-sincronizacion.js [js/nube.js]
 *
 * Cada caso reproduce una averia que costo datos de verdad. El servidor
 * falso (tools/supabase-falso.js) respeta claves unicas, claves ajenas y
 * columnas generadas, asi que un cliente que mande algo que Postgres
 * rechazaria falla aqui igual que en produccion. */
var falso = require("./supabase-falso.js");
var UID = "11111111-1111-4111-8111-111111111111";
var FUENTE = process.argv[2] || "js/nube.js";
var fallos = 0;

function montar(opciones){
  opciones = opciones || {};
  var almacen = opciones.almacen || {};
  var srv = falso.crearServidorFalso({
    sesion: opciones.sinSesion ? null : {user:{id:UID, email:"a@b.c"}},
    antesDeUpsert: opciones.antesDeUpsert
  });
  global.localStorage = {
    getItem: function(k){ return k in almacen ? almacen[k] : null; },
    setItem: function(k,v){
      if(opciones.discoLleno){ var e = new Error("full"); e.name = "QuotaExceededError"; throw e; }
      almacen[k] = String(v);
    },
    removeItem: function(k){ delete almacen[k]; }
  };
  global.CONFIG = {SUPABASE_URL:"https://x.supabase.co", SUPABASE_ANON_KEY:"k"};
  global.navigator = {};
  global.document = {addEventListener:function(){}, visibilityState:"visible"};
  global.window = {crypto: require("crypto").webcrypto, addEventListener:function(){},
                   supabase:{createClient:function(){ return srv.cliente; }}};
  var Nube;
  eval(require("fs").readFileSync(FUENTE, "utf8"));
  return {Nube: Nube, srv: srv, almacen: almacen};
}

function comprueba(nombre, ok, detalle){
  console.log((ok ? "  ok   " : "  FALLO") + "  " + nombre + (detalle ? "   (" + detalle + ")" : ""));
  if(!ok) fallos++;
}
var espera = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };

(async function(){
console.log("\n1. Un entreno local que nunca llego al servidor no se borra al sincronizar");
{
  var series = [];
  for(var i = 1; i <= 19; i++) series.push({id:"x"+i, usuario:UID, sesion:"s1", ejercicio:"01",
    slot:0, n_serie:i, peso:40, reps:8, hecha_en:"2026-09-04T18:00:00Z"});
  var m = montar({almacen:{
    "sp:estado": JSON.stringify({sesiones:[{id:"s1", usuario:UID, fecha:"2026-09-04", dia:"d1",
      modo:"conPartido", series_plan:19, completada:true}], series:series, logros:[]}),
    "sp:cola": "[]"}});
  await m.Nube.init(); await espera(400);
  comprueba("las 19 series siguen en el dispositivo", m.Nube.get().series.length === 19,
            m.Nube.get().series.length + "/19");
  comprueba("y acaban subidas al servidor", m.srv.tablas.serie.length === 19,
            m.srv.tablas.serie.length + "/19");
}

console.log("\n2. Cache perdida: rehacer el mismo dia no rompe la clave ajena");
{
  var m = montar();
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-04", "d1", "conPartido", 3);
  for(var i = 1; i <= 3; i++) m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8});
  await espera(300);
  var subidas = m.srv.tablas.serie.length;
  // el dispositivo pierde la cache y el usuario repite el dia
  var m2 = montar({almacen:{}});
  m2.srv.tablas.sesion = m.srv.tablas.sesion;
  m2.srv.tablas.serie = m.srv.tablas.serie;
  await m2.Nube.init();
  var s2 = m2.Nube.sesionDe("2026-09-04", "d1", "conPartido", 3);
  m2.Nube.marcarSerie(s2, {ejercicio:"01", slot:0, n_serie:1, peso:45, reps:8});
  await espera(400);
  comprueba("primera vez subio", subidas === 3, subidas + "/3");
  comprueba("el id de la sesion coincide sin cache", s2.id === s.id);
  comprueba("no queda nada atascado en la cola", m2.Nube.pendientes() === 0,
            m2.Nube.pendientes() + " pendientes");
  comprueba("sin filas rechazadas", m2.Nube.rechazadas().length === 0,
            (m2.Nube.rechazadas()[0] || {}).motivo || "");
  comprueba("el peso corregido llego al servidor",
            m2.srv.tablas.serie.filter(function(x){ return x.n_serie === 1; })[0].peso === 45);
}

console.log("\n3. Una fila invalida no bloquea el resto de la cola");
{
  var m = montar();
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-05", "d1", "conPartido", 3);
  m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:1, peso:40, reps:"3,5"});  // decimal
  m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:2, peso:999999, reps:8});  // desbordado
  m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:3, peso:40, reps:8});      // buena
  await espera(500);
  comprueba("las tres se guardan en el dispositivo", m.Nube.get().series.length === 3);
  comprueba("la buena llega al servidor",
            m.srv.tablas.serie.some(function(x){ return x.n_serie === 3; }));
  comprueba("la cola no se queda atascada", m.Nube.pendientes() === 0,
            m.Nube.pendientes() + " pendientes");
}

console.log("\n4. Desmarcar una serie sin cobertura no la resucita al volver la red");
{
  var m = montar({sinSesion:true});
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-06", "d1", "conPartido", 2);
  m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:1, peso:80, reps:5});
  m.Nube.desmarcarSerie(s, {ejercicio:"01", slot:0, n_serie:1});
  comprueba("desaparece del dispositivo", m.Nube.get().series.length === 0);
  comprueba("y tambien de la cola", m.Nube.pendientes() === 1,
            m.Nube.pendientes() + " pendientes (solo la sesion)");
}

console.log("\n5. El disco lleno se nota en vez de fingir que se guardo");
{
  var m = montar({discoLleno:true});
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-07", "d1", "conPartido", 1);
  var ok = m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:1, peso:40, reps:8});
  comprueba("marcarSerie avisa de que no ha podido guardar", ok === false);
  comprueba("y hay un error de disco que ensenar", !!m.Nube.errorDisco(), m.Nube.errorDisco() || "");
}

console.log("\n6. Datos de otra cuenta no se cuelan en la tuya");
{
  var OTRO = "22222222-2222-4222-8222-222222222222";
  var m = montar({almacen:{
    "sp:estado": JSON.stringify({
      sesiones:[{id:"z1", usuario:OTRO, fecha:"2026-09-01", dia:"d1", modo:"conPartido",
                 series_plan:3, completada:true}],
      series:[{id:"z2", usuario:OTRO, sesion:"z1", ejercicio:"01", slot:0, n_serie:1,
               peso:99, reps:9, hecha_en:"2026-09-01T10:00:00Z"}], logros:[]}),
    "sp:cola":"[]"}});
  await m.Nube.init(); await espera(300);
  comprueba("no se suben a la cuenta de quien entra",
            !m.srv.tablas.serie.some(function(x){ return x.peso === 99; }));
}

console.log("\n7. Mas de 1000 series: la descarga no se queda a medias");
{
  var srvSeries = [];
  for(var i = 1; i <= 1450; i++) srvSeries.push({id:"r"+i, usuario:UID, sesion:"s1",
    ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8, hecha_en:"2026-08-01T10:00:00Z"});
  var m = montar();
  m.srv.tablas.sesion.push({id:"s1", usuario:UID, fecha:"2026-08-01", dia:"d1",
    modo:"conPartido", series_plan:19, completada:true});
  m.srv.tablas.serie = srvSeries;
  await m.Nube.init(); await espera(600);
  comprueba("se descargan las 1450", m.Nube.get().series.length === 1450,
            m.Nube.get().series.length + "/1450");
}

console.log("\n8. Entrar por primera vez con datos locales no duplica el historial");
{
  var alm = {};
  var m = montar({sinSesion:true, almacen:alm});
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-08", "d1", "conPartido", 3);
  for(var i = 1; i <= 3; i++) m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8});
  await espera(150);
  var m2 = montar({almacen:alm});          // ahora entra con la cuenta
  await m2.Nube.init(); await espera(500);
  var st = m2.Nube.get();
  comprueba("una sola sesion, no dos", st.sesiones.length === 1, st.sesiones.length + "");
  comprueba("tres series, no seis", st.series.length === 3, st.series.length + "");
  comprueba("ninguna quedo con usuario local",
            !st.series.concat(st.sesiones).some(function(f){ return f.usuario === "local"; }));
  comprueba("y las tres estan arriba", m2.srv.tablas.serie.length === 3,
            m2.srv.tablas.serie.length + "/3");
  comprueba("sin filas rechazadas", m2.Nube.rechazadas().length === 0,
            (m2.Nube.rechazadas()[0] || {}).motivo || "");
}

console.log("\n9. La lista de rechazadas no crece en cada sincronizacion");
{
  var m = montar({antesDeUpsert:function(t, f){
    return (t === "serie" && f.n_serie === 2) ? {code:"22P02", message:"invalid input syntax"} : null;
  }});
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-09", "d1", "conPartido", 3);
  for(var i = 1; i <= 3; i++) m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8});
  await espera(300);
  var uno = m.Nube.rechazadas().length;
  await m.Nube.sincronizar(); await espera(200);
  await m.Nube.sincronizar(); await espera(200);
  comprueba("no se apilan copias", m.Nube.rechazadas().length <= uno,
            uno + " -> " + m.Nube.rechazadas().length);
}

console.log("\n10. Un rechazo de RLS no atasca el resto de la cola");
{
  var m = montar({antesDeUpsert:function(t, f){
    return (t === "serie" && f.n_serie === 1)
      ? {code:"42501", message:"new row violates row-level security policy"} : null;
  }});
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-10", "d1", "conPartido", 3);
  for(var i = 1; i <= 3; i++) m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8});
  await espera(400);
  comprueba("las otras dos suben igual", m.srv.tablas.serie.length === 2,
            m.srv.tablas.serie.length + "/2");
  comprueba("la cola no queda bloqueada", m.Nube.pendientes() === 0,
            m.Nube.pendientes() + " pendientes");
}

console.log("\n11. Paginar con el servidor devolviendo otro orden no pierde ni duplica");
{
  var m = montar();
  m.srv = falso.crearServidorFalso({sesion:{user:{id:UID, email:"a@b.c"}}, ordenInestable:true});
  var m3 = montar({almacen:{}});
  m3.srv.tablas.sesion.push({id:"s1", usuario:UID, fecha:"2026-08-01", dia:"d1",
    modo:"conPartido", series_plan:19, completada:true});
  for(var i = 1; i <= 1500; i++) m3.srv.tablas.serie.push({id:"r"+String(i).padStart(5,"0"),
    usuario:UID, sesion:"s1", ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8,
    hecha_en:"2026-08-01T10:00:00Z"});
  await m3.Nube.init(); await espera(800);
  var ids = {}, dup = 0;
  m3.Nube.get().series.forEach(function(x){ if(ids[x.id]) dup++; ids[x.id] = true; });
  comprueba("las 1500 distintas", Object.keys(ids).length === 1500, Object.keys(ids).length + "");
  comprueba("sin duplicadas", dup === 0, dup + " duplicadas");
}

console.log("\n12. Restaurar un respaldo despues de borrar no se deshace solo");
{
  var m = montar();
  await m.Nube.init();
  var s = m.Nube.sesionDe("2026-09-11", "d1", "conPartido", 3);
  for(var i = 1; i <= 3; i++) m.Nube.marcarSerie(s, {ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8});
  await espera(300);
  global.Respaldo = null;
  eval(require("fs").readFileSync("js/respaldo.js", "utf8"));
  var copia = Respaldo.serializar(m.Nube.get());
  for(var i = 1; i <= 3; i++) m.Nube.desmarcarSerie(s, {ejercicio:"01", slot:0, n_serie:i});
  await espera(200);
  comprueba("borradas", m.Nube.get().series.length === 0);
  var r = Respaldo.importar(copia, m.Nube.get());
  m.Nube.desenterrar("sesion", r.filas.sesiones);
  m.Nube.desenterrar("serie", r.filas.series);
  m.Nube.guardar();
  await m.Nube.sincronizar(); await espera(300);
  comprueba("la restauracion aguanta la sincronizacion", m.Nube.get().series.length === 3,
            m.Nube.get().series.length + "/3");
  comprueba("y vuelve a estar arriba", m.srv.tablas.serie.length === 3,
            m.srv.tablas.serie.length + "/3");
}

console.log(fallos ? "\n" + fallos + " COMPROBACIONES FALLIDAS\n" : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
})();
