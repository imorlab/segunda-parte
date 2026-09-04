/* Prueba de regresion de la sincronizacion.
 *
 *   node tools/prueba-sincronizacion.js js/nube.js
 *
 * Reproduce el caso que costo un entreno de verdad: tienes una sesion
 * guardada en el movil, en el servidor no hay nada porque la subida se
 * perdio por el camino, y la cola esta vacia. Se sincroniza.
 *
 * Una cola vacia NO demuestra que lo local haya llegado al servidor. Si
 * la descarga reemplaza el estado en vez de reconciliarlo, el entreno
 * desaparece sin un solo mensaje de error.
 *
 * Simula lo justo del navegador: localStorage y un cliente de Supabase
 * falso con latencia. */
var almacen = {};
global.localStorage = {
  getItem: k => (k in almacen ? almacen[k] : null),
  setItem: (k,v) => { almacen[k] = String(v); }, removeItem: k => { delete almacen[k]; }
};
var UID = "11111111-1111-4111-8111-111111111111";
var servidor = {sesion:[], serie:[], logro:[]};      // servidor VACIO
global.CONFIG = {SUPABASE_URL:"https://x.supabase.co", SUPABASE_ANON_KEY:"k"};
global.navigator = {};
global.window = {
  crypto: require("crypto").webcrypto,
  supabase: {createClient: () => ({
    auth: {onAuthStateChange(){}, getSession: () => Promise.resolve({data:{session:{user:{id:UID,email:"a@b.c"}}}})},
    from(tabla){ return {
      upsert(f){ return new Promise(r => setTimeout(() => {
        servidor[tabla].push(JSON.parse(JSON.stringify(f))); r({error:null}); }, 2)); },
      select(){ const t = tabla; return {eq(){ return {
        order(){ return Promise.resolve({data: servidor[t], error:null}); },
        then(fn){ return Promise.resolve({data: servidor[t], error:null}).then(fn); }};}};},
      delete(){ return {eq(){ return Promise.resolve({error:null}); }}; }
    };}
  })}
};

// Estado de partida: una sesion completa en el movil, cola VACIA.
var series = [];
for (var i = 1; i <= 19; i++) series.push({id:"x"+i, usuario:UID, sesion:"s1",
  ejercicio:"01", slot:0, n_serie:i, peso:40, reps:8, hecha_en:"2026-09-04T18:00:00Z"});
almacen["sp:estado"] = JSON.stringify({
  sesiones:[{id:"s1", usuario:UID, fecha:"2026-09-04", dia:"d1", modo:"conPartido",
             series_plan:19, completada:true}],
  series: series, logros:[]});
almacen["sp:cola"] = "[]";

eval(require("fs").readFileSync(process.argv[2] || "js/nube.js", "utf8"));
(async () => {
  await Nube.init();
  await new Promise(r => setTimeout(r, 400));
  var st = Nube.get();
  console.log("  sesiones en el movil :", st.sesiones.length);
  console.log("  series en el movil   :", st.series.length);
  console.log("  series en el servidor:", servidor.serie.length);
  var ok = st.series.length === 19 && servidor.serie.length === 19;
  console.log(ok
    ? "  >> OK: el entreno sobrevive y acaba en el servidor"
    : "  >> FALLO: quedan " + st.series.length + " de 19 series");
  process.exit(ok ? 0 : 1);
})();
