/* Datos: cache local primero, Supabase detras.

   En el gimnasio la cobertura es mala, asi que nada espera a la red: cada
   serie se guarda al instante y se encola para subirla.

   Reglas duras, cada una escrita despues de perder datos de verdad:

   1. Los ids son DETERMINISTAS, derivados de la clave natural de la fila.
      Dos dispositivos, o el mismo tras perder la cache, generan el mismo
      id para el mismo hecho fisico. Sin esto, un upsert por clave natural
      intenta reescribir la clave primaria de la sesion y el FK de serie
      lo rechaza, dejando el dia entero atascado.
   2. Sincronizar NUNCA borra. Lo local que no este arriba se conserva y
      se reencola. Una cola vacia no demuestra que nada quede por subir.
   3. Nada falla en silencio. Si el disco esta lleno o una fila es
      rechazada para siempre, se ve.
   4. Se reconcilia por clave natural, no por id, para que una divergencia
      de ids no duplique series y no infle el XP. */

var Nube = (function(){
  "use strict";

  var CACHE = "sp:estado", COLA = "sp:cola", MUERTAS = "sp:rechazadas",
      TUMBAS = "sp:borradas", EMAIL = "sp:email";
  var cli = null, sesionAuth = null, oyentes = [];
  var errorDisco = null, ultimoError = null, persistido = null;

  /* ------------------------------------------------------- almacenamiento */

  function leer(k, pordefecto){
    var v = null;
    try { v = localStorage.getItem(k); } catch(e){ return pordefecto; }
    if(!v) return pordefecto;
    try { return JSON.parse(v); }
    catch(e){
      /* Guardar lo ilegible antes de seguir: el arranque con estado vacio
         acabaria sobrescribiendolo, y ahi dentro puede estar casi todo. */
      try { localStorage.setItem(k + ".roto." + Date.now(), v); } catch(e2){}
      errorDisco = "Se han encontrado datos ilegibles y se han apartado a un lado.";
      return pordefecto;
    }
  }

  function escribir(k, v){
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e){
      errorDisco = (e && e.name === "QuotaExceededError")
        ? "El almacenamiento del navegador está lleno: lo último NO se ha guardado."
        : "El navegador no deja guardar en este dispositivo: lo último NO se ha guardado.";
      return false;
    }
  }

  /* Id aleatorio, solo para cosas sin clave natural. */
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* Id derivado del texto: mismo texto, mismo uuid, en cualquier
     dispositivo y despues de cualquier borrado. */
  function idDe(texto){
    var h = 1779033703 ^ texto.length, i;
    for(i = 0; i < texto.length; i++){
      h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    var sig = function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
    var t = "";
    for(i = 0; i < 4; i++) t += ("00000000" + sig().toString(16)).slice(-8);
    return t.slice(0,8) + "-" + t.slice(8,12) + "-8" + t.slice(13,16) + "-" +
           ((parseInt(t[16],16) & 3 | 8).toString(16)) + t.slice(17,20) + "-" + t.slice(20,32);
  }

  /* --------------------------------------------------------- tablas */

  /* clave: identidad natural de la fila, la misma que el indice unico del
     esquema. cols: lo unico que se sube, para no mandar nunca columnas
     generadas como e1rm, que Postgres rechaza siempre. */
  var TABLAS = {
    sesion: {clave:["usuario","fecha","dia"],
             cols:["id","usuario","fecha","dia","modo","series_plan","completada"]},
    serie:  {clave:["sesion","ejercicio","slot","n_serie"],
             cols:["id","usuario","sesion","ejercicio","slot","n_serie","variante","peso","reps","hecha_en"]},
    logro:  {clave:["usuario","clave"], cols:["usuario","clave","fecha"]}
  };
  var LISTA = {sesion:"sesiones", serie:"series", logro:"logros"};

  function claveDe(tabla, f){
    return TABLAS[tabla].clave.map(function(c){ return String(f[c]); }).join("|");
  }
  function soloColumnas(tabla, f){
    var out = {};
    TABLAS[tabla].cols.forEach(function(c){ if(f[c] !== undefined) out[c] = f[c]; });
    return out;
  }

  var estado = leer(CACHE, {sesiones:[], series:[], logros:[]});
  function vacio(){ return {sesiones:[], series:[], logros:[]}; }

  function avisar(){
    oyentes.forEach(function(f){
      try { f(estado); } catch(e){ if(window.console) console.error("oyente:", e); }
    });
  }
  function alCambiar(f){ oyentes.push(f); }

  /* Tumbas: lo que se borra a proposito deja marca. Sin ellas la fusion
     de abajo, y la descarga del servidor, resucitan la serie borrada.
     Caducan a los 90 dias para que la lista no crezca sin fin. */
  var DIAS_TUMBA = 90;
  function tumbas(){
    var t = leer(TUMBAS, {}), corte = Date.now() - DIAS_TUMBA * 86400000, limpio = {}, cambia = false;
    Object.keys(t).forEach(function(k){
      if(t[k] > corte) limpio[k] = t[k]; else cambia = true;
    });
    if(cambia) escribir(TUMBAS, limpio);
    return limpio;
  }
  function enterrar(tabla, fila){
    var t = tumbas();
    t[tabla + ":" + claveDe(tabla, fila)] = Date.now();
    escribir(TUMBAS, t);
  }

  /* Releer antes de escribir y fundir: otra pestana (o la misma web en
     Safari, que en iOS es otro contenedor) puede haber anadido cosas.
     Lo enterrado no vuelve. */
  function guardarCache(){
    var disco = leer(CACHE, vacio()), t = tumbas();
    ["sesiones","series","logros"].forEach(function(l){
      var tabla = l === "sesiones" ? "sesion" : l === "series" ? "serie" : "logro";
      var hay = {};
      estado[l].forEach(function(f){ hay[claveDe(tabla, f)] = true; });
      (disco[l] || []).forEach(function(f){
        var k = claveDe(tabla, f);
        if(!hay[k] && !t[tabla + ":" + k]) estado[l].push(f);
      });
    });
    escribir(CACHE, estado);
    avisar();
  }

  /* Para los vaciados deliberados: fundir con el disco los desharia. */
  function guardarCacheDirecto(){
    escribir(CACHE, estado);
    avisar();
  }

  /* ------------------------------------------------------------ conexion */

  function configurado(){
    return typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL &&
           CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_URL.indexOf("TU-PROYECTO") < 0;
  }
  function conectado(){ return !!(cli && sesionAuth); }
  function modo(){ return !configurado() ? "local" : conectado() ? "conectado" : "desconectado"; }
  function email(){ return sesionAuth ? sesionAuth.user.email : leer(EMAIL, null); }
  function uid(){ return sesionAuth ? sesionAuth.user.id : "local"; }

  /* WebKit concede el modo persistente usando como heuristica que la app
     este instalada en la pantalla de inicio. Sin el, iOS puede desalojar
     el origen entero por falta de espacio y se va todo de golpe. */
  function pedirPersistencia(){
    if(!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persisted().then(function(ya){
      if(ya){ persistido = true; return true; }
      return navigator.storage.persist().then(function(ok){ persistido = ok; return ok; });
    }).catch(function(){ return null; });
  }

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

  /* En iOS una web app de la pantalla de inicio tiene su propio contenedor
     de almacenamiento, separado de Safari. El enlace del correo abre
     Safari, crea la sesion alli y esta app no la ve nunca; con PKCE ademas
     falla, porque el verificador se quedo aqui. De ahi el codigo. */
  function pedirCodigo(dir){
    if(!cli) return Promise.reject(new Error("Supabase sin configurar"));
    return cli.auth.signInWithOtp({email: dir, options:{shouldCreateUser:true}})
      .then(function(r){ if(r.error) throw r.error; escribir(EMAIL, dir); return true; });
  }

  /* Acepta el codigo de 6 digitos o el enlace del correo pegado tal cual.
     Lo segundo evita tener que tocar la plantilla del correo en Supabase,
     y sobre todo evita ABRIR el enlace: abrirlo lo manda a Safari, que en
     iOS es otro contenedor, y la sesion se crearia donde no sirve. Como
     el acceso se pidio desde aqui, el verificador de PKCE esta aqui. */
  function tokenDelEnlace(txt){
    var u;
    try { u = new URL(txt); } catch(e){ return null; }
    var q = u.searchParams;
    var h = new URLSearchParams(String(u.hash || "").replace(/^#/, ""));
    var at = h.get("access_token"), rt = h.get("refresh_token");
    if(at && rt) return {tipo:"sesion", access_token:at, refresh_token:rt};
    var code = q.get("code") || h.get("code");
    if(code) return {tipo:"codigo", code:code};
    var th = q.get("token_hash") || q.get("token");
    if(th) return {tipo:"hash", token_hash:th, clase:q.get("type") || "magiclink"};
    return null;
  }

  function verificarCodigo(dir, entrada){
    if(!cli) return Promise.reject(new Error("Supabase sin configurar"));
    var txt = String(entrada || "").trim();
    var tras = function(r){
      if(r.error) throw r.error;
      sesionAuth = (r.data && r.data.session) || sesionAuth;
      if(!sesionAuth) throw new Error("El enlace ya se había usado o ha caducado.");
      if(dir) escribir(EMAIL, dir);
      return sincronizar();
    };

    var limpio = txt.replace(/\s+/g, "");
    if(/^\d{4,10}$/.test(limpio)){
      if(!dir) return Promise.reject(new Error("Falta el correo."));
      return cli.auth.verifyOtp({email:dir, token:limpio, type:"email"}).then(tras);
    }

    var t = tokenDelEnlace(txt);
    if(!t) return Promise.reject(new Error(
      "Eso no es un código ni un enlace de acceso. Copia el enlace del correo sin abrirlo."));
    if(t.tipo === "sesion")
      return cli.auth.setSession({access_token:t.access_token, refresh_token:t.refresh_token}).then(tras);
    if(t.tipo === "codigo")
      return cli.auth.exchangeCodeForSession(t.code).then(tras);
    return cli.auth.verifyOtp({token_hash:t.token_hash, type:t.clase}).then(tras);
  }

  function salir(){
    var p = cli ? cli.auth.signOut() : Promise.resolve();
    return p.then(function(){
      sesionAuth = null;
      estado = vacio();
      escribir(COLA, []);
      escribir(MUERTAS, []);
      escribir(TUMBAS, {});
      try { localStorage.removeItem(EMAIL); } catch(e){}
      guardarCacheDirecto();
    });
  }

  /* ---------------------------------------------------------------- cola */

  /* Cada entrada lleva identificador propio y aleatorio. Con un contador,
     dos contextos con la cola vacia generaban el mismo numero y al vaciar
     uno se borraba la entrada del otro sin haberla subido. */
  function encolar(tabla, fila){
    var c = leer(COLA, []);
    var k = tabla + ":" + claveDe(tabla, fila);
    /* Una serie remarcada sustituye a su pendiente en vez de acumularse. */
    c = c.filter(function(it){ return it.k !== k; });
    c.push({qid:uuid(), k:k, tabla:tabla, fila:soloColumnas(tabla, fila)});
    return escribir(COLA, c);
  }

  function desencolar(tabla, fila){
    var k = tabla + ":" + claveDe(tabla, fila);
    escribir(COLA, leer(COLA, []).filter(function(it){ return it.k !== k; }));
  }

  /* Errores que no van a arreglarse reintentando: la fila es invalida y
     bloquearia la cola para siempre. Se aparta con su motivo a la vista. */
  var PERMANENTE = /22P02|22003|428C9|23503|23514|22001|invalid input syntax|numeric field overflow|non-DEFAULT value/i;
  function esPermanente(e){
    return !!(e && PERMANENTE.test((e.code || "") + " " + (e.message || "")));
  }

  var vaciando = false, otraVuelta = false;

  function vaciarCola(){
    if(!conectado()) return Promise.resolve(0);
    if(vaciando){ otraVuelta = true; return Promise.resolve(leer(COLA, []).length); }
    var c = leer(COLA, []);
    if(!c.length){ ultimoError = null; return Promise.resolve(0); }

    vaciando = true;
    var quitar = {}, muertas = [], fallo = null, corta = false;
    return c.reduce(function(cad, item){
      return cad.then(function(){
        if(corta) return;                       // sin red: no seguir golpeando
        var t = TABLAS[item.tabla];
        var op = {onConflict: t.clave.join(",")};
        if(item.tabla === "logro") op.ignoreDuplicates = true;   // no pisar la fecha del logro
        return cli.from(item.tabla).upsert(item.fila, op).then(function(r){
          if(r.error) throw r.error;
          quitar[item.qid] = true;
        }).catch(function(e){
          fallo = (e && e.message) ? e.message : "error desconocido";
          if(esPermanente(e)){
            quitar[item.qid] = true;
            muertas.push({qid:item.qid, tabla:item.tabla, fila:item.fila, motivo:fallo,
                          cuando:new Date().toISOString()});
          } else {
            corta = true;                       // fallo de red: reintentar entero luego
          }
        });
      });
    }, Promise.resolve()).then(function(){
      var queda = leer(COLA, []).filter(function(it){ return !quitar[it.qid]; });
      escribir(COLA, queda);
      if(muertas.length) escribir(MUERTAS, leer(MUERTAS, []).concat(muertas));
      ultimoError = (queda.length || muertas.length) ? fallo : null;
      vaciando = false;
      if(otraVuelta){ otraVuelta = false; return vaciarCola(); }
      return queda.length;
    }).catch(function(){
      vaciando = false; otraVuelta = false;
      return leer(COLA, []).length;
    });
  }

  /* -------------------------------------------------------- sincronizar */

  /* Al entrar con una cuenta, lo guardado antes lleva usuario "local", que
     no es un uuid. Se le pone el id real y, como el id de la sesion se
     deriva de el, hay que recalcularlo y reapuntar sus series.

     Solo se adopta lo marcado como "local": si en el dispositivo quedaran
     datos de OTRA cuenta, reetiquetarlos los meteria en la cuenta
     equivocada. En ese caso se descartan. */
  function adoptar(){
    if(!sesionAuth) return 0;
    var u = sesionAuth.user.id, n = 0, mapa = {};

    var ajenas = estado.sesiones.some(function(s){ return s.usuario !== u && s.usuario !== "local"; });
    if(ajenas){
      estado = vacio();
      escribir(COLA, []);
      errorDisco = "Había datos de otra cuenta en este dispositivo y se han descartado.";
      guardarCacheDirecto();
      return 0;
    }

    estado.sesiones.forEach(function(s){
      if(s.usuario === "local"){
        var viejo = s.id;
        s.usuario = u;
        s.id = idDe("sesion|" + claveDe("sesion", s));
        mapa[viejo] = s.id;
        encolar("sesion", s); n++;
      }
    });
    estado.series.forEach(function(x){
      var toca = false;
      if(mapa[x.sesion]){ x.sesion = mapa[x.sesion]; toca = true; }
      if(x.usuario === "local"){ x.usuario = u; toca = true; }
      if(toca){
        x.id = idDe("serie|" + claveDe("serie", x));
        encolar("serie", x); n++;
      }
    });
    estado.logros.forEach(function(l){
      if(l.usuario === "local"){ l.usuario = u; encolar("logro", l); n++; }
    });
    if(n) guardarCache();
    return n;
  }

  /* Descarga paginada: PostgREST corta en 1000 filas por defecto, y una
     descarga truncada haria creer que faltan cientos de series. */
  function bajarTodo(tabla, uid){
    var filas = [], paso = 1000;
    var pagina = function(desde){
      return cli.from(tabla).select("*").eq("usuario", uid)
               .range(desde, desde + paso - 1).then(function(r){
        if(r.error) throw r.error;
        filas = filas.concat(r.data || []);
        return (r.data && r.data.length === paso) ? pagina(desde + paso) : filas;
      });
    };
    return pagina(0);
  }

  /* Se reconcilia por clave natural, no por id: si un id diverge, casar
     por id duplicaria la serie y con ella el XP y el volumen. */
  function reconciliar(locales, remotos, tabla){
    var t = tumbas();
    var vivo = function(f){ return !t[tabla + ":" + claveDe(tabla, f)]; };
    /* Lo enterrado que siga arriba se vuelve a borrar en el servidor. */
    remotos.filter(function(f){ return !vivo(f); }).forEach(function(f){
      if(conectado()) cli.from(tabla).delete().eq("id", f.id).then(function(){}, function(){});
    });
    remotos = remotos.filter(vivo);
    var hay = {};
    remotos.forEach(function(f){ hay[claveDe(tabla, f)] = true; });
    var solo = locales.filter(function(f){ return vivo(f) && !hay[claveDe(tabla, f)]; });
    solo.forEach(function(f){ encolar(tabla, f); });
    return {filas: remotos.concat(solo), reencoladas: solo.length};
  }

  function sincronizar(){
    if(!conectado()) return Promise.resolve(estado);
    var u = sesionAuth.user.id;
    adoptar();
    return vaciarCola().then(function(){
      return Promise.all([bajarTodo("sesion", u), bajarTodo("serie", u), bajarTodo("logro", u)]);
    }).then(function(r){
      var a = reconciliar(estado.sesiones, r[0], "sesion");
      var b = reconciliar(estado.series,   r[1], "serie");
      var c = reconciliar(estado.logros,   r[2], "logro");
      estado = {sesiones:a.filas, series:b.filas, logros:c.filas};
      guardarCache();
      if(a.reencoladas + b.reencoladas + c.reencoladas) return vaciarCola().then(function(){ return estado; });
      return estado;
    }).catch(function(e){
      ultimoError = "No se ha podido sincronizar: " + ((e && e.message) || "sin conexión");
      return estado;
    });
  }

  /* -------------------------------------------------------------- escribir */

  function sesionDe(fecha, dia, mododia, seriesPlan){
    var s = estado.sesiones.filter(function(x){ return x.fecha === fecha && x.dia === dia; })[0];
    if(s) return s;
    s = {usuario:uid(), fecha:fecha, dia:dia, modo:mododia, series_plan:seriesPlan, completada:false};
    s.id = idDe("sesion|" + claveDe("sesion", s));
    estado.sesiones.push(s);
    encolar("sesion", s);
    guardarCache();
    return s;
  }

  /* Validar antes de encolar: un decimal en reps o un peso desmedido son
     rechazados por Postgres para siempre y atascan la cola entera. */
  function saneaSerie(datos){
    var peso = datos.peso, reps = datos.reps;
    if(peso != null){
      peso = Math.round(Number(peso) * 100) / 100;
      if(!isFinite(peso) || peso < 0 || peso > 9999) peso = null;
    }
    if(reps != null){
      reps = Math.round(Number(reps));
      if(!isFinite(reps) || reps < 0 || reps > 10000) reps = null;
    }
    return {peso: peso != null ? peso : null, reps: reps != null ? reps : null};
  }

  function marcarSerie(s, datos){
    var v = saneaSerie(datos);
    var fila = {
      usuario: uid(), sesion: s.id,
      ejercicio: datos.ejercicio, slot: datos.slot, n_serie: datos.n_serie,
      variante: datos.variante || null, peso: v.peso, reps: v.reps,
      hecha_en: new Date().toISOString()
    };
    fila.id = idDe("serie|" + claveDe("serie", fila));
    var t = tumbas(), k = "serie:" + claveDe("serie", fila);
    if(t[k]){ delete t[k]; escribir(TUMBAS, t); }   // volver a marcarla la resucita
    estado.series = estado.series.filter(function(x){
      return claveDe("serie", x) !== claveDe("serie", fila);
    });
    estado.series.push(fila);
    var ok = encolar("serie", fila);
    guardarCache();
    if(conectado()) vaciarCola();
    return ok;
  }

  function desmarcarSerie(s, datos){
    var buscada = {sesion:s.id, ejercicio:datos.ejercicio, slot:datos.slot, n_serie:datos.n_serie};
    var k = claveDe("serie", buscada);
    var f = estado.series.filter(function(x){ return claveDe("serie", x) === k; })[0];
    if(!f) return;
    estado.series = estado.series.filter(function(x){ return x !== f; });
    /* Retirar tambien lo pendiente y dejar tumba: si no, la subida
       pendiente o la siguiente descarga resucitan la serie. */
    desencolar("serie", f);
    enterrar("serie", f);
    guardarCacheDirecto();
    if(conectado()){
      cli.from("serie").delete().eq("id", f.id).then(function(r){
        if(r && r.error) ultimoError = "No se pudo borrar la serie en el servidor: " + r.error.message;
      }, function(e){
        ultimoError = "No se pudo borrar la serie en el servidor: " + ((e && e.message) || "sin conexión");
      });
    }
  }

  function cerrarSesion(s, completada){
    s.completada = completada;
    encolar("sesion", s);
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

  /* ------------------------------------------------------------ arranque */

  /* Otro contexto del mismo origen ha escrito: recargar en vez de seguir
     con una foto vieja que al guardarse machacaria lo suyo. */
  if(window.addEventListener){
    window.addEventListener("storage", function(e){
      if(e.key !== CACHE) return;
      estado = leer(CACHE, vacio());
      avisar();
    });
    /* Reintentar en cuanto vuelva la red o al volver a la app, sin
       esperar a que se marque otra serie. */
    window.addEventListener("online", function(){ vaciarCola(); });
    document.addEventListener("visibilitychange", function(){
      if(document.visibilityState === "visible" && conectado()) sincronizar();
      else vaciarCola();
    });
  }

  return {
    init:init, pedirCodigo:pedirCodigo, verificarCodigo:verificarCodigo,
    salir:salir, sincronizar:sincronizar,
    modo:modo, conectado:conectado, configurado:configurado, email:email,
    alCambiar:alCambiar,
    get: function(){ return estado; },
    guardar: guardarCache,
    sesionDe:sesionDe, marcarSerie:marcarSerie, desmarcarSerie:desmarcarSerie,
    cerrarSesion:cerrarSesion, guardarLogro:guardarLogro,
    pendientes: function(){ return leer(COLA, []).length; },
    rechazadas: function(){ return leer(MUERTAS, []); },
    olvidarRechazadas: function(){ escribir(MUERTAS, []); },
    ultimoError: function(){ return ultimoError; },
    errorDisco: function(){ return errorDisco; },
    pedirPersistencia: pedirPersistencia,
    persistido: function(){ return persistido; }
  };
})();
