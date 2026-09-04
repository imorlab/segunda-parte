/* Reglas del juego: XP, niveles, rachas, records y logros.
   Todo son funciones puras sobre el estado. El mismo calculo vale con
   datos de Supabase o del cache local, asi el marcador no cambia segun
   haya cobertura en el gimnasio o no. */

var Juego = (function(){
  "use strict";

  var META_SEMANAL = 2;          // sesiones por semana para no romper racha
  /* Una sesion cuenta con el 70% de las series previstas. Exigir el 100%
     hacia que saltarte un ejercicio porque la maquina estaba ocupada te
     costase la racha entera, y que anadir ejercicios al plan invalidase
     sesiones ya hechas. */
  var COMPLETA_PCT = 0.7;
  var XP_SERIE  = 10;
  var XP_SESION = 50;
  var XP_RECORD = 100;
  var XP_LOGRO  = {comun:75, rara:150, epica:300};

  /* Curva de niveles. Con dos sesiones semanales salen unos 440 XP de base,
     mas records y logros: entre 500 y 800 por semana segun la racha. Los
     primeros niveles caen pronto para enganchar; a partir del quinto cada
     salto cuesta cerca del doble, y Leyenda queda a ano y medio de
     constancia real. Sin escalon final no habria nada que perseguir. */
  var NIVELES = [
    {min:0,     nombre:"Suplente"},
    {min:1000,  nombre:"Convocado"},
    {min:2800,  nombre:"Titular"},
    {min:5600,  nombre:"Fijo en el once"},
    {min:10000, nombre:"Capitan"},
    {min:16500, nombre:"Pichichi"},
    {min:25500, nombre:"Balon de Oro"},
    {min:37500, nombre:"Historico"},
    {min:54000, nombre:"Leyenda"}
  ];

  /* Indice de semana: el lunes de esa fecha en dias desde epoch. Dos
     semanas seguidas se llevan exactamente 7, asi la racha es una resta. */
  function semanaIdx(fecha){
    var t = new Date(fecha + "T12:00:00");
    if(isNaN(t)) t = new Date(fecha);
    t.setHours(12,0,0,0);
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return Math.round(t.getTime() / 86400000);
  }
  function hoyISO(){
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  /* Series necesarias para dar la sesion por hecha. */
  function minimoSesion(plan){
    if(!plan) return 1;
    return Math.max(1, Math.ceil(plan * COMPLETA_PCT));
  }
  function sesionCompleta(hechas, plan){ return hechas >= minimoSesion(plan); }

  /* ------------------------------------------------------------ records */

  /* Mejor serie de cada ejercicio, medida en 1RM estimado (Epley).
     Compara pesos distintos a repeticiones distintas: 60x8 supera a 70x4. */
  function e1rm(s){
    if(s.peso == null || s.reps == null || s.reps <= 0) return null;
    return Math.round(s.peso * (1 + s.reps / 30) * 100) / 100;
  }
  /* Las marcas se agrupan por movimiento real, no por hueco del plan: un
     rack pull mueve mucho mas peso que un trap bar por tener menos
     recorrido, y compararlos daria un record falso imposible de batir.
     Las series antiguas no llevan variante: son el ejercicio principal. */
  function claveMarca(s){ return s.ejercicio + "|" + (s.variante || ""); }

  function records(series){
    var r = {};
    series.forEach(function(s){
      var v = s.e1rm != null ? Number(s.e1rm) : e1rm(s);
      if(v == null) return;
      var k = claveMarca(s), a = r[k];
      if(!a || v > a.e1rm) r[k] = {e1rm:v, peso:s.peso, reps:s.reps, fecha:s.hecha_en,
                                   ejercicio:s.ejercicio, variante:s.variante || null};
    });
    return r;
  }

  /* Cuantas veces has batido tu marca. Recorre en orden y cuenta cada
     serie que supero todo lo anterior de ese ejercicio. La primera de
     cada ejercicio no cuenta: tener una marca no es batirla. */
  function recordsBatidos(series){
    var mejor = {}, n = 0;
    series.slice().sort(function(a,b){ return String(a.hecha_en).localeCompare(String(b.hecha_en)); })
      .forEach(function(s){
        var v = s.e1rm != null ? Number(s.e1rm) : e1rm(s);
        if(v == null) return;
        var k = claveMarca(s);
        if(mejor[k] == null){ mejor[k] = v; return; }
        if(v > mejor[k]){ mejor[k] = v; n++; }
      });
    return n;
  }

  /* ------------------------------------------------------------- rachas */

  function porSemana(sesiones){
    var c = {};
    sesiones.forEach(function(s){
      if(!s.completada) return;
      var k = semanaIdx(s.fecha);
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }

  /* Semanas seguidas cumpliendo la meta. La semana en curso no rompe la
     racha si todavia no esta cumplida: aun estas a tiempo. */
  function racha(sesiones, hoy){
    var c = porSemana(sesiones);
    var esta = semanaIdx(hoy || hoyISO());
    var i = (c[esta] || 0) >= META_SEMANAL ? esta : esta - 7;
    var n = 0;
    while((c[i] || 0) >= META_SEMANAL){ n++; i -= 7; }

    var claves = Object.keys(c).map(Number).filter(function(k){ return c[k] >= META_SEMANAL; }).sort(function(a,b){ return a-b; });
    var mejor = 0, run = 0, prev = null;
    claves.forEach(function(k){
      run = (prev !== null && k - prev === 7) ? run + 1 : 1;
      if(run > mejor) mejor = run;
      prev = k;
    });
    return {actual:n, mejor:Math.max(mejor, n), estaSemana:c[esta] || 0, meta:META_SEMANAL};
  }

  /* ------------------------------------------------------------- XP */

  function volumen(series){
    return series.reduce(function(a,s){
      return a + (s.peso != null && s.reps != null ? Number(s.peso) * Number(s.reps) : 0);
    }, 0);
  }

  function xp(estado){
    var sesiones = (estado.sesiones || []).filter(function(s){ return s.completada; }).length;
    var porLogros = (estado.logros || []).reduce(function(a, l){
      var def = LOGROS.filter(function(x){ return x.clave === l.clave; })[0];
      return a + (XP_LOGRO[def && def.rango] || XP_LOGRO.comun);
    }, 0);
    return (estado.series || []).length * XP_SERIE
         + sesiones * XP_SESION
         + recordsBatidos(estado.series || []) * XP_RECORD
         + porLogros;
  }

  function nivel(puntos){
    var i = 0;
    while(i + 1 < NIVELES.length && puntos >= NIVELES[i+1].min) i++;
    var base = NIVELES[i].min;
    var techo = i + 1 < NIVELES.length ? NIVELES[i+1].min : null;
    return {
      n: i + 1,
      nombre: NIVELES[i].nombre,
      xp: puntos,
      desde: base,
      hasta: techo,
      falta: techo == null ? 0 : techo - puntos,
      pct: techo == null ? 100 : Math.round((puntos - base) / (techo - base) * 100)
    };
  }

  /* ------------------------------------------------------------- logros */

  var LOGROS = [
    {clave:"debut", rango:"comun",      icono:"🎽", nombre:"Debut",           desc:"Completa tu primera sesion.",
      test:function(c){ return c.sesiones >= 1; }},
    {clave:"semana", rango:"comun",     icono:"📅", nombre:"Semana redonda",  desc:"Las dos sesiones de una misma semana.",
      test:function(c){ return c.racha.actual >= 1 || c.racha.mejor >= 1; }},
    {clave:"diez", rango:"rara",       icono:"🔟", nombre:"Diez de diez",    desc:"10 sesiones completadas.",
      test:function(c){ return c.sesiones >= 10; }},
    {clave:"treinta", rango:"epica",    icono:"🏛️", nombre:"Veterano",        desc:"30 sesiones completadas.",
      test:function(c){ return c.sesiones >= 30; }},
    {clave:"techo", rango:"comun",      icono:"📈", nombre:"Nuevo techo",     desc:"Bate tu marca en un ejercicio.",
      test:function(c){ return c.records >= 1; }},
    {clave:"techo10", rango:"epica",    icono:"🚀", nombre:"Sin techo",       desc:"Bate tu marca 10 veces.",
      test:function(c){ return c.records >= 10; }},
    {clave:"mes", rango:"rara",        icono:"🔥", nombre:"Mes entero",      desc:"4 semanas seguidas sin fallar.",
      test:function(c){ return c.racha.mejor >= 4; }},
    {clave:"trimestre", rango:"epica",  icono:"💎", nombre:"Trimestre",       desc:"12 semanas seguidas sin fallar.",
      test:function(c){ return c.racha.mejor >= 12; }},
    {clave:"tonelada", rango:"rara",   icono:"🏗️", nombre:"Tonelada",        desc:"1.000 kg movidos en una sola sesion.",
      test:function(c){ return c.mejorVolumenSesion >= 1000; }},
    {clave:"diezton", rango:"rara",    icono:"🐘", nombre:"Diez toneladas",  desc:"10.000 kg movidos en total.",
      test:function(c){ return c.volumen >= 10000; }},
    {clave:"madrugador", rango:"comun", icono:"🌅", nombre:"Madrugador",      desc:"Termina una serie antes de las 8:00.",
      test:function(c){ return c.horas.some(function(h){ return h < 8; }); }},
    {clave:"nocturno", rango:"comun",   icono:"🌙", nombre:"Turno de noche",  desc:"Termina una serie despues de las 22:00.",
      test:function(c){ return c.horas.some(function(h){ return h >= 22; }); }}
  ];

  /* Contexto que consultan los tests. Se calcula una vez, no una por logro. */
  function contexto(estado){
    var series = estado.series || [], sesiones = estado.sesiones || [];
    var porSesion = {};
    series.forEach(function(s){
      if(s.peso == null || s.reps == null) return;
      porSesion[s.sesion] = (porSesion[s.sesion] || 0) + Number(s.peso) * Number(s.reps);
    });
    return {
      sesiones: sesiones.filter(function(s){ return s.completada; }).length,
      series: series.length,
      records: recordsBatidos(series),
      racha: racha(sesiones),
      volumen: volumen(series),
      mejorVolumenSesion: Object.keys(porSesion).reduce(function(a,k){ return Math.max(a, porSesion[k]); }, 0),
      horas: series.map(function(s){ return new Date(s.hecha_en).getHours(); })
    };
  }

  /* Claves que el estado ya merece, esten guardadas o no. Quien las
     compare con lo guardado sabra cuales son nuevas y hay que celebrar. */
  function logrosGanados(estado){
    var c = contexto(estado);
    return LOGROS.filter(function(l){
      try { return l.test(c); } catch(e){ return false; }
    }).map(function(l){ return l.clave; });
  }

  return {
    META_SEMANAL: META_SEMANAL,
    XP_LOGRO: XP_LOGRO,
    COMPLETA_PCT: COMPLETA_PCT,
    minimoSesion: minimoSesion,
    sesionCompleta: sesionCompleta,
    NIVELES: NIVELES,
    LOGROS: LOGROS,
    semanaIdx: semanaIdx,
    hoyISO: hoyISO,
    e1rm: e1rm,
    claveMarca: claveMarca,
    records: records,
    recordsBatidos: recordsBatidos,
    racha: racha,
    volumen: volumen,
    xp: xp,
    nivel: nivel,
    contexto: contexto,
    logrosGanados: logrosGanados
  };
})();
