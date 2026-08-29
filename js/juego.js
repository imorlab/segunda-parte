/* Reglas del juego: XP, niveles, rachas, records y logros.
   Todo son funciones puras sobre el estado. El mismo calculo vale con
   datos de Supabase o del cache local, asi el marcador no cambia segun
   haya cobertura en el gimnasio o no. */

var Juego = (function(){
  "use strict";

  var META_SEMANAL = 2;          // sesiones por semana para no romper racha
  var XP_SERIE  = 10;
  var XP_SESION = 50;
  var XP_RECORD = 100;
  var XP_LOGRO  = 75;

  var NIVELES = [
    {min:0,     nombre:"Suplente"},
    {min:500,   nombre:"Convocado"},
    {min:1200,  nombre:"Titular"},
    {min:2200,  nombre:"Fijo en el once"},
    {min:3600,  nombre:"Capitan"},
    {min:5500,  nombre:"Pichichi"},
    {min:8000,  nombre:"Balon de Oro"},
    {min:11000, nombre:"Leyenda"}
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

  /* ------------------------------------------------------------ records */

  /* Mejor serie de cada ejercicio, medida en 1RM estimado (Epley).
     Compara pesos distintos a repeticiones distintas: 60x8 supera a 70x4. */
  function e1rm(s){
    if(s.peso == null || s.reps == null || s.reps <= 0) return null;
    return Math.round(s.peso * (1 + s.reps / 30) * 100) / 100;
  }
  function records(series){
    var r = {};
    series.forEach(function(s){
      var v = s.e1rm != null ? Number(s.e1rm) : e1rm(s);
      if(v == null) return;
      var a = r[s.ejercicio];
      if(!a || v > a.e1rm) r[s.ejercicio] = {e1rm:v, peso:s.peso, reps:s.reps, fecha:s.hecha_en};
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
        if(mejor[s.ejercicio] == null){ mejor[s.ejercicio] = v; return; }
        if(v > mejor[s.ejercicio]){ mejor[s.ejercicio] = v; n++; }
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
    return (estado.series || []).length * XP_SERIE
         + sesiones * XP_SESION
         + recordsBatidos(estado.series || []) * XP_RECORD
         + (estado.logros || []).length * XP_LOGRO;
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
    {clave:"debut",      icono:"🎽", nombre:"Debut",           desc:"Completa tu primera sesion.",
      test:function(c){ return c.sesiones >= 1; }},
    {clave:"semana",     icono:"📅", nombre:"Semana redonda",  desc:"Las dos sesiones de una misma semana.",
      test:function(c){ return c.racha.actual >= 1 || c.racha.mejor >= 1; }},
    {clave:"diez",       icono:"🔟", nombre:"Diez de diez",    desc:"10 sesiones completadas.",
      test:function(c){ return c.sesiones >= 10; }},
    {clave:"treinta",    icono:"🏛️", nombre:"Veterano",        desc:"30 sesiones completadas.",
      test:function(c){ return c.sesiones >= 30; }},
    {clave:"techo",      icono:"📈", nombre:"Nuevo techo",     desc:"Bate tu marca en un ejercicio.",
      test:function(c){ return c.records >= 1; }},
    {clave:"techo10",    icono:"🚀", nombre:"Sin techo",       desc:"Bate tu marca 10 veces.",
      test:function(c){ return c.records >= 10; }},
    {clave:"mes",        icono:"🔥", nombre:"Mes entero",      desc:"4 semanas seguidas sin fallar.",
      test:function(c){ return c.racha.mejor >= 4; }},
    {clave:"trimestre",  icono:"💎", nombre:"Trimestre",       desc:"12 semanas seguidas sin fallar.",
      test:function(c){ return c.racha.mejor >= 12; }},
    {clave:"tonelada",   icono:"🏗️", nombre:"Tonelada",        desc:"1.000 kg movidos en una sola sesion.",
      test:function(c){ return c.mejorVolumenSesion >= 1000; }},
    {clave:"diezton",    icono:"🐘", nombre:"Diez toneladas",  desc:"10.000 kg movidos en total.",
      test:function(c){ return c.volumen >= 10000; }},
    {clave:"madrugador", icono:"🌅", nombre:"Madrugador",      desc:"Termina una serie antes de las 8:00.",
      test:function(c){ return c.horas.some(function(h){ return h < 8; }); }},
    {clave:"nocturno",   icono:"🌙", nombre:"Turno de noche",  desc:"Termina una serie despues de las 22:00.",
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
    NIVELES: NIVELES,
    LOGROS: LOGROS,
    semanaIdx: semanaIdx,
    hoyISO: hoyISO,
    e1rm: e1rm,
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
