/* Datos: cache local primero, Supabase detras.

   En el gimnasio la cobertura es mala, asi que nada espera a la red:
   cada serie se guarda en localStorage al instante y se encola para
   subirla. Los ids los genera el cliente, asi la fila local y la remota
   comparten identificador y subir es un upsert idempotente: reintentar
   nunca duplica. */

var Nube = (function(){
  "use strict";

  var CACHE = "sp:estado", COLA = "sp:cola", EMAIL = "sp:email";
  var cli = null, sesionAuth = null, oyentes = [];

  function leer(k, pordefecto){
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : pordefecto; }
    catch(e){ return pordefecto; }
  }
  function escribir(k, v){
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){}
  }

  /* crypto.randomUUID no existe en contextos no seguros; el respaldo no
     tiene que ser criptografico, solo unico entre tus propios entrenos. */
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  var estado = leer(CACHE, {sesiones:[], series:[], logros:[]});
  function vacio(){ return {sesiones:[], series:[], logros:[]}; }

  function avisar(){ oyentes.forEach(function(f){ try { f(estado); } catch(e){} }); }
  function alCambiar(f){ oyentes.push(f); }
  function guardarCache(){ escribir(CACHE, estado); avisar(); }

  /* ------------------------------------------------------------ conexion */

  function configurado(){
    return typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL &&
           CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_URL.indexOf("TU-PROYECTO") < 0;
  }
  function conectado(){ return !!(cli && sesionAuth); }
  function modo(){ return !configurado() ? "local" : conectado() ? "conectado" : "desconectado"; }
  function email(){ return sesionAuth ? sesionAuth.user.email : leer(EMAIL, null); }

  function init(){
    if(!configurado() || !window.supabase) return Promise.resolve(modo());
    cli = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    cli.auth.onAuthStateChange(function(_e, s){
      sesionAuth = s;
      if(s) escribir(EMAIL, s.user.email);
      avisar();
    });
    return cli.auth.getSession().then(function(r){
      sesionAuth = r.data.session;
      return sesionAuth ? sincronizar().then(function(){ return modo(); }) : modo();
    }).catch(function(){ return modo(); });
  }

  function entrar(dir){
    if(!cli) return Promise.reject(new Error("Supabase sin configurar"));
    return cli.auth.signInWithOtp({
      email: dir,
      options: {emailRedirectTo: location.href.split("#")[0]}
    }).then(function(r){
      if(r.error) throw r.error;
      escribir(EMAIL, dir);
      return true;
    });
  }

  /* Salir borra el cache: en un dispositivo compartido no debe quedar
     el historial de nadie a la vista. */
  function salir(){
    var p = cli ? cli.auth.signOut() : Promise.resolve();
    return p.then(function(){
      sesionAuth = null;
      estado = vacio();
      escribir(COLA, []);
      guardarCache();
    });
  }

  /* ---------------------------------------------------------------- cola */

  /* Cada entrada lleva numero propio para poder borrar de la cola justo
     lo que se subio, sin tocar lo que se haya encolado entretanto. */
  function encolar(tabla, fila){
    var c = leer(COLA, []);
    var n = c.reduce(function(a, i){ return Math.max(a, i.n || 0); }, 0) + 1;
    c.push({n:n, tabla:tabla, fila:fila});
    escribir(COLA, c);
  }

  /* Las dos tablas tienen, ademas de la clave primaria, una clave natural
     unica. Sin decirselo, upsert resuelve solo por id: una fila con id
     nuevo que choque en la clave natural falla, vuelve a la cola y se
     queda ahi para siempre reintentandose. */
  var CHOQUE = {
    sesion: "usuario,fecha,dia",
    serie:  "sesion,ejercicio,slot,n_serie",
    logro:  "usuario,clave"
  };

  var ultimoError = null, vaciando = false, otraVuelta = false;

  /* Sube lo pendiente. Dos precauciones que costaron datos por no estar:

     - Un solo vaciado a la vez. Se llama al marcar cada serie, asi que en
       una sesion se solapaban veinte, y cada uno reescribia la cola con
       la foto que habia leido al empezar, borrando lo encolado mientras.
     - Al terminar se relee la cola y se quita solo lo que se subio de
       verdad, en vez de reescribirla entera. */
  function vaciarCola(){
    if(!conectado()) return Promise.resolve(0);
    if(vaciando){ otraVuelta = true; return Promise.resolve(leer(COLA, []).length); }
    var c = leer(COLA, []);
    if(!c.length){ ultimoError = null; return Promise.resolve(0); }

    vaciando = true;
    var subidos = {}, fallo = null;
    return c.reduce(function(cad, item){
      return cad.then(function(){
        var op = CHOQUE[item.tabla] ? {onConflict: CHOQUE[item.tabla]} : undefined;
        return cli.from(item.tabla).upsert(item.fila, op).then(function(r){
          if(r.error) throw r.error;
          subidos[item.n] = true;
        }).catch(function(e){
          /* Guardar el motivo: un fallo mudo deja la impresion de que se
             esta guardando cuando no llega nada al servidor. */
          fallo = (e && e.message) ? e.message : "error desconocido";
        });
      });
    }, Promise.resolve()).then(function(){
      var queda = leer(COLA, []).filter(function(it){ return !subidos[it.n]; });
      escribir(COLA, queda);
      ultimoError = queda.length ? fallo : null;
      vaciando = false;
      if(otraVuelta){ otraVuelta = false; return vaciarCola(); }
      return queda.length;
    }).catch(function(){
      vaciando = false;
      return leer(COLA, []).length;
    });
  }

  /* Lo entrenado antes de entrar con la cuenta se guardo con usuario
     "local", que no es un uuid y Supabase rechaza. Al iniciar sesion se
     le pone el id real y se reencola: sin esto se quedaba atascado en la
     cola para siempre y la descarga lo borraba de la vista. */
  function adoptar(){
    if(!sesionAuth) return 0;
    var u = sesionAuth.user.id, n = 0;
    [["sesiones","sesion"], ["series","serie"], ["logros","logro"]].forEach(function(par){
      estado[par[0]].forEach(function(f){
        if(f.usuario !== u){ f.usuario = u; encolar(par[1], f); n++; }
      });
    });
    var c = leer(COLA, []);
    c.forEach(function(it){ if(it.fila) it.fila.usuario = u; });
    escribir(COLA, c);
    if(n) guardarCache();
    return n;
  }

  /* Sincronizar no puede borrar nada: lo local que no este en el servidor
     se conserva y se reencola para subirlo. Antes se reemplazaba el estado
     entero cuando la cola estaba vacia, y una cola vacia no demuestra que
     lo local haya llegado: bastaba con que se hubiera perdido por el
     camino para que la descarga arrasase el entreno.

     El precio es que un borrado hecho en otro dispositivo reaparece. Se
     acepta: perder un entreno es mucho peor que ver de mas una serie. */
  function reconciliar(locales, remotos, clave, tabla){
    var hay = {};
    remotos.forEach(function(f){ hay[f[clave]] = true; });
    var solo = locales.filter(function(f){ return !hay[f[clave]]; });
    solo.forEach(function(f){ encolar(tabla, f); });
    return {filas: remotos.concat(solo), reencoladas: solo.length};
  }

  function sincronizar(){
    if(!conectado()) return Promise.resolve(estado);
    var uid = sesionAuth.user.id;
    adoptar();
    return vaciarCola().then(function(){
      return Promise.all([
        cli.from("sesion").select("*").eq("usuario", uid).order("fecha", {ascending:true}),
        cli.from("serie").select("*").eq("usuario", uid).order("hecha_en", {ascending:true}),
        cli.from("logro").select("*").eq("usuario", uid)
      ]);
    }).then(function(r){
      if(r[0].error || r[1].error || r[2].error) return estado;
      var a = reconciliar(estado.sesiones, r[0].data || [], "id", "sesion");
      var b = reconciliar(estado.series,   r[1].data || [], "id", "serie");
      var c = reconciliar(estado.logros,   r[2].data || [], "clave", "logro");
      estado = {sesiones:a.filas, series:b.filas, logros:c.filas};
      guardarCache();
      /* Lo que faltaba arriba se acaba de reencolar: subirlo ahora. */
      if(a.reencoladas + b.reencoladas + c.reencoladas) return vaciarCola().then(function(){ return estado; });
      return estado;
    }).catch(function(){ return estado; });
  }

  /* -------------------------------------------------------------- escribir */

  function uid(){ return sesionAuth ? sesionAuth.user.id : "local"; }

  /* Devuelve la sesion de hoy para ese dia del plan, creandola si hace
     falta. Es la que agrupa las series del entreno en curso. */
  function sesionDe(fecha, dia, mododia, seriesPlan){
    var s = estado.sesiones.filter(function(x){ return x.fecha === fecha && x.dia === dia; })[0];
    if(s) return s;
    s = {id:uuid(), usuario:uid(), fecha:fecha, dia:dia, modo:mododia,
         series_plan:seriesPlan, completada:false, creada:new Date().toISOString()};
    estado.sesiones.push(s);
    encolar("sesion", s);
    guardarCache();
    return s;
  }

  function marcarSerie(s, datos){
    var fila = {
      id: uuid(), usuario: uid(), sesion: s.id,
      ejercicio: datos.ejercicio, slot: datos.slot, n_serie: datos.n_serie,
      variante: datos.variante || null,
      peso: datos.peso != null ? datos.peso : null,
      reps: datos.reps != null ? datos.reps : null,
      hecha_en: new Date().toISOString()
    };
    var prev = estado.series.filter(function(x){
      return x.sesion === s.id && x.ejercicio === datos.ejercicio &&
             x.slot === datos.slot && x.n_serie === datos.n_serie;
    })[0];
    if(prev){ fila.id = prev.id; estado.series = estado.series.filter(function(x){ return x !== prev; }); }
    estado.series.push(fila);
    encolar("serie", fila);
    guardarCache();
    if(conectado()) vaciarCola();
    return fila;
  }

  function desmarcarSerie(s, datos){
    var f = estado.series.filter(function(x){
      return x.sesion === s.id && x.ejercicio === datos.ejercicio &&
             x.slot === datos.slot && x.n_serie === datos.n_serie;
    })[0];
    if(!f) return;
    estado.series = estado.series.filter(function(x){ return x !== f; });
    guardarCache();
    if(conectado()) cli.from("serie").delete().eq("id", f.id).then(function(){}, function(){});
  }

  function cerrarSesion(s, completada){
    s.completada = completada;
    encolar("sesion", {id:s.id, usuario:s.usuario, fecha:s.fecha, dia:s.dia, modo:s.modo,
                       series_plan:s.series_plan, completada:completada});
    guardarCache();
    if(conectado()) vaciarCola();
  }

  function guardarLogro(clave){
    if(estado.logros.some(function(l){ return l.clave === clave; })) return false;
    var fila = {usuario:uid(), clave:clave, fecha:new Date().toISOString()};
    estado.logros.push(fila);
    encolar("logro", fila);
    guardarCache();
    if(conectado()) vaciarCola();
    return true;
  }

  return {
    init:init, entrar:entrar, salir:salir, sincronizar:sincronizar,
    modo:modo, conectado:conectado, configurado:configurado, email:email,
    alCambiar:alCambiar,
    get: function(){ return estado; },
    sesionDe:sesionDe, marcarSerie:marcarSerie, desmarcarSerie:desmarcarSerie,
    cerrarSesion:cerrarSesion, guardarLogro:guardarLogro, guardar:guardarCache,
    ultimoError: function(){ return ultimoError; },
    pendientes: function(){ return leer(COLA, []).length; }
  };
})();
