/* Interfaz: pinta el plan, registra las series y muestra el progreso.
   Las reglas del juego viven en juego.js y los datos en nube.js; aqui
   solo se decide que se ve y cuando. */

(function(){
  "use strict";

  var modo = "conPartido", refDay = 4;   // refDay: viernes
  var ABR = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  /* Descanso: los basicos pesados piden 2 min; el resto se recupera en 90 s. */
  var BASICO = {"01":1,"02":1,"04":1,"06":1,"09":1};
  function restDe(id){ return BASICO[id] ? 120 : 90; }

  function $(id){ return document.getElementById(id); }

  /* Sustituto elegido en cada ficha. Se guarda porque no es un capricho
     del dia: si tu gimnasio no tiene una barra, no la va a tener la semana
     que viene.

     Se guarda el nombre, no la posicion en la lista: al reordenar los
     sustitutos una posicion guardada pasaria a apuntar a otro ejercicio,
     y te encontrarias haciendo otra cosa sin haber tocado nada. */
  function claveVar(o){ return o.day + ":" + o.badge + ":" + o.slot; }
  function leerVariantes(){
    try { return JSON.parse(localStorage.getItem("sp:variantes") || "{}"); } catch(e){ return {}; }
  }
  function guardarVariante(o, nombre){
    var v = leerVariantes();
    if(nombre) v[claveVar(o)] = nombre; else delete v[claveVar(o)];
    try { localStorage.setItem("sp:variantes", JSON.stringify(v)); } catch(e){}
  }
  function ytSearch(q){ return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q); }
  function num(v){
    if(v == null || v === "") return null;
    var n = parseFloat(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  }
  function kg(n){
    return (Math.round(n * 10) / 10).toLocaleString("es-ES", {maximumFractionDigits:1});
  }

  /* --------------------------------------------------------- sesion actual */

  function totalSeries(dia){
    return PLAN[modo][dia].reduce(function(a,p){ return a + p.sets; }, 0);
  }
  function sesionDelDia(dia, crear){
    var hoy = Juego.hoyISO();
    var s = Nube.get().sesiones.filter(function(x){ return x.fecha === hoy && x.dia === dia; })[0];
    if(s || !crear) return s;
    return Nube.sesionDe(hoy, dia, modo, totalSeries(dia));
  }
  function seriesDelDia(dia){
    var s = sesionDelDia(dia, false);
    if(!s) return [];
    return Nube.get().series.filter(function(x){ return x.sesion === s.id; });
  }
  function serieMarcada(dia, ejercicio, slot, n){
    return seriesDelDia(dia).filter(function(x){
      return x.ejercicio === ejercicio && x.slot === slot && x.n_serie === n;
    })[0];
  }

  /* Ultimo peso y reps de ese ejercicio, para no teclear lo mismo cada
     vez: si repites carga basta con pulsar el visto. */
  /* Ultimo peso y reps del mismo movimiento. Filtra por variante: tras
     cambiar de trap bar a hip thrust, prerrellenar con la carga anterior
     seria una sugerencia peligrosa. */
  function ultimaDe(ejercicio, variante, n){
    var todas = Nube.get().series
      .filter(function(x){
        return x.ejercicio === ejercicio && x.peso != null && (x.variante || null) === (variante || null);
      })
      .sort(function(a,b){ return String(b.hecha_en).localeCompare(String(a.hecha_en)); });
    return todas.filter(function(x){ return x.n_serie === n; })[0] || todas[0] || null;
  }

  /* Series de la ultima sesion en que hiciste este mismo movimiento, para
     tener delante contra que estas compitiendo hoy. */
  function ultimaSesionDe(ejercicio, variante, excluir){
    var previas = Nube.get().series.filter(function(x){
      return x.ejercicio === ejercicio &&
             (x.variante || null) === (variante || null) &&
             x.sesion !== excluir && x.peso != null;
    });
    if(!previas.length) return null;
    var ult = previas.reduce(function(a, b){
      return String(a.hecha_en) > String(b.hecha_en) ? a : b;
    });
    /* Una serie por numero: la base lo garantiza con una clave unica, pero
       un cache viejo o a medio migrar podria traer repetidos y la linea
       se haria interminable. */
    var porNumero = {};
    previas.filter(function(x){ return x.sesion === ult.sesion; })
           .forEach(function(x){ porNumero[x.n_serie] = x; });
    return {
      fecha: ult.hecha_en,
      series: Object.keys(porNumero).map(Number).sort(function(a, b){ return a - b; })
                    .map(function(k){ return porNumero[k]; })
    };
  }

  var MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  function dia_mes(iso){
    var d = new Date(iso);
    return isNaN(d) ? "" : d.getDate() + " " + MES[d.getMonth()];
  }

  /* ------------------------------------------------------------ recompensas */

  /* El nombre que se ensena: el del sustituto si se uso, y si no el del
     ejercicio principal. Las series antiguas no llevan variante. */
  function nombreMarca(r){
    if(r.variante) return r.variante;
    return EX[r.ejercicio] ? EX[r.ejercicio].n : r.ejercicio;
  }

  function foto(){
    var st = Nube.get(), x = Juego.xp(st);
    return {xp:x, nivel:Juego.nivel(x).n, records:Juego.records(st.series),
            nRecords:Juego.recordsBatidos(st.series), logros:st.logros.map(function(l){ return l.clave; })};
  }

  /* Guarda los logros que el estado ya merece y devuelve los nuevos. */
  function otorgarLogros(){
    var nuevos = [];
    Juego.logrosGanados(Nube.get()).forEach(function(c){
      if(Nube.guardarLogro(c)) nuevos.push(c);
    });
    return nuevos;
  }

  /* Cada tipo de aviso tiene su color, su vibracion y su etiqueta, para
     que batir una marca no se sienta igual que terminar una serie mas. */
  var TIPOS = {
    sesion:  {tono:"var(--acento)", et:"Sesión",  vibra:[30,40,30]},
    record:  {tono:"var(--epico)",  et:"Récord",  vibra:[45,45,45,45,80]},
    comun:   {tono:"var(--acento)", et:"Logro",   vibra:[30,50,60]},
    rara:    {tono:"var(--raro)",   et:"Logro raro",  vibra:[40,50,40,50,70]},
    epica:   {tono:"var(--epico)",  et:"Logro épico", vibra:[60,50,60,50,60,50,110]}
  };

  var cola = [], mostrando = false, nivelPendiente = null;

  function brindis(tipo, icono, titulo, detalle, xp){
    cola.push({tipo:tipo, icono:icono, titulo:titulo, detalle:detalle || "", xp:xp || ""});
    if(!mostrando) siguienteBrindis();
  }

  function siguienteBrindis(){
    var t = $("toast");
    if(!cola.length){
      mostrando = false; t.hidden = true;
      /* El nivel se guarda para el final: es el remate, no un aviso mas. */
      if(nivelPendiente){ var n = nivelPendiente; nivelPendiente = null; pantallaNivel(n); }
      return;
    }
    mostrando = true;
    var m = cola.shift(), d = TIPOS[m.tipo] || TIPOS.comun;
    t.style.setProperty("--tono", d.tono);
    t.innerHTML = '<span class="ti"></span><span class="tt">' +
                  '<span class="tr"></span><b></b><i></i></span><span class="tx"></span>';
    t.querySelector(".ti").textContent = m.icono;
    t.querySelector(".tr").textContent = d.et;
    t.querySelector("b").textContent = m.titulo;
    t.querySelector("i").textContent = m.detalle;
    t.querySelector(".tx").textContent = m.xp;
    t.hidden = false;
    t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
    vibrar(d.vibra);
    setTimeout(siguienteBrindis, 2700);
  }

  function vibrar(patron){
    try { if(navigator.vibrate) navigator.vibrate(patron); } catch(e){}
  }

  /* Numerito de XP saliendo del propio boton: la recompensa mas pequena y
     la mas frecuente, asi que va sin aviso ni cola, solo un guino. */
  function flotaXP(desde, texto){
    var r = desde.getBoundingClientRect();
    var e = document.createElement("span");
    e.className = "xpflota";
    e.textContent = texto;
    e.style.left = (r.left + r.width / 2) + "px";
    e.style.top = (r.top - 6) + "px";
    document.body.appendChild(e);
    setTimeout(function(){ e.remove(); }, 1100);
  }

  function pantallaNivel(n){
    var capa = $("nivelUp");
    capa.innerHTML =
      '<div class="conf"></div>' +
      '<div class="nuCaja">' +
        '<span class="nuEt">Has subido de nivel</span>' +
        '<span class="nuN"></span>' +
        '<span class="nuNom" id="nuNom"></span>' +
        '<span class="nuPie"></span>' +
        '<span class="nuTocar">Toca para seguir</span>' +
      '</div>';
    capa.querySelector(".nuN").textContent = n.n;
    capa.querySelector(".nuNom").textContent = n.nombre;
    capa.querySelector(".nuPie").textContent = n.hasta == null
      ? n.xp.toLocaleString("es-ES") + " XP · nivel máximo"
      : n.xp.toLocaleString("es-ES") + " XP · siguiente a " + n.hasta.toLocaleString("es-ES");
    confeti(capa.querySelector(".conf"));
    capa.hidden = false;
    vibrar([70,60,70,60,70,60,160]);
    var cerrar = function(){ capa.hidden = true; capa.innerHTML = ""; };
    capa.addEventListener("click", cerrar, {once:true});
    setTimeout(function(){ if(!capa.hidden) cerrar(); }, 5200);
  }

  function confeti(host){
    var tonos = ["var(--acento)", "var(--epico)", "var(--raro)", "var(--texto)"];
    for(var i = 0; i < 44; i++){
      var p = document.createElement("i");
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = tonos[i % tonos.length];
      p.style.animationDuration = (1.5 + Math.random() * 1.4) + "s";
      p.style.animationDelay = (Math.random() * 0.5) + "s";
      p.style.opacity = 0.55 + Math.random() * 0.45;
      host.appendChild(p);
    }
  }

  /* Compara el antes y el despues de marcar una serie y celebra lo que
     haya cambiado. El orden importa: primero los logros, que dan XP y
     pueden ser los que hagan subir de nivel. */
  function celebrar(antes){
    var nuevosLogros = otorgarLogros();
    var d = foto();

    Object.keys(d.records).forEach(function(k){
      var a = antes.records[k];
      if(a && d.records[k].e1rm > a.e1rm){
        var r = d.records[k];
        brindis("record", "🏆", nombreMarca(r),
                kg(r.peso) + " kg × " + r.reps + " — tu mejor marca", "+100");
      }
    });
    nuevosLogros.forEach(function(c){
      var l = Juego.LOGROS.filter(function(x){ return x.clave === c; })[0];
      if(l) brindis(l.rango || "comun", l.icono, l.nombre, l.desc,
                    "+" + (Juego.XP_LOGRO[l.rango] || Juego.XP_LOGRO.comun));
    });
    if(d.nivel > antes.nivel){
      nivelPendiente = Juego.nivel(d.xp);
      /* La pantalla espera a que se vacie la cola para ser el remate. Si
         no hay ningun aviso que mostrar, esa cola no llega a arrancar y
         habria que dispararla aqui. */
      if(!mostrando){ var n = nivelPendiente; nivelPendiente = null; pantallaNivel(n); }
    }
  }

  /* ----------------------------------------------------------------- ficha */

  function card(o){
    var variants = [{n:o.n,q:o.q,c:o.c,reps:o.reps}].concat((o.alts||[]).map(function(a){
      return {n:a.n,q:a.q,c:a.c,reps:a.reps||o.reps};
    }));
    var cur = 0, guardada = leerVariantes()[claveVar(o)];
    variants.forEach(function(v, i){ if(v.n === guardada) cur = i; });
    var chipEls = null;

    var el = document.createElement("article");
    el.className = "ex";
    el.innerHTML =
      '<button class="head" aria-expanded="false">' +
        '<span class="dorsal">' + o.badge + '</span>' +
        '<span class="nm"><b></b><span class="alt"></span></span>' +
        '<span class="reps"></span><span class="chev">▾</span>' +
      '</button>' +
      '<div class="body" hidden>' +
        (variants.length > 1 ? '<span class="lbl">Cambiar por</span><div class="chips"></div>' : '') +
        '<ul class="cues"></ul>' +
        (o.sets ? '<span class="lbl">Series</span><div class="ultima" hidden></div><div class="sets"></div>' : '') +
        '<div class="vid">' +
          '<a class="yt" target="_blank" rel="noopener">▶ Ver cómo se hace</a>' +
        '</div>' +
      '</div>';

    var nameEl = el.querySelector(".nm b"), altEl = el.querySelector(".nm .alt"),
        repsEl = el.querySelector(".reps"), cuesEl = el.querySelector(".cues"),
        ytEl = el.querySelector(".yt");

    function paint(){
      var v = variants[cur];
      nameEl.textContent = v.n;
      altEl.textContent = cur === 0 ? (o.nota || "") : "Sustituye a " + variants[0].n;
      altEl.style.display = altEl.textContent ? "block" : "none";
      repsEl.textContent = v.reps;
      cuesEl.innerHTML = "";
      v.c.forEach(function(t){ var li = document.createElement("li"); li.textContent = t; cuesEl.appendChild(li); });
      ytEl.href = ytSearch(v.q);
      if(chipEls) chipEls.forEach(function(b,i){ b.setAttribute("aria-pressed", i === cur ? "true" : "false"); });
    }

    if(variants.length > 1){
      var chips = el.querySelector(".chips");
      chipEls = variants.map(function(v,i){
        var b = document.createElement("button");
        b.className = "chip"; b.type = "button";
        b.textContent = i === 0 ? "Principal" : v.n;
        b.addEventListener("click", function(){
          cur = i;
          guardarVariante(o, i ? v.n : null);
          paint();
          repintarFichas(el, o);
        });
        chips.appendChild(b);
        return b;
      });
    }

    var head = el.querySelector(".head"), body = el.querySelector(".body");
    head.addEventListener("click", function(){
      var open = body.hidden;
      body.hidden = !open;
      el.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });

    o.variante = function(){ return variants[cur].n; };

    if(o.sets){
      var box = el.querySelector(".sets");
      for(var i = 1; i <= o.sets; i++) box.appendChild(filaSerie(el, o, i));
      repintarFichas(el, o);
    }

    paint();
    return el;
  }

  /* Una fila por serie: peso, repeticiones y el visto que la da por
     hecha. El visto arranca el descanso, que es lo unico que necesitas
     tocar si repites la carga de la vez anterior. */
  function filaSerie(el, o, i){
    var fila = document.createElement("div");
    fila.className = "serie";
    fila.innerHTML =
      '<span class="sn"></span>' +
      '<input class="kg" type="text" inputmode="decimal" autocomplete="off" placeholder="—">' +
      '<span class="u">kg ×</span>' +
      '<input class="rp" type="text" inputmode="numeric" autocomplete="off" placeholder="—">' +
      '<button class="ok" type="button" aria-pressed="false">✓</button>';

    var sn = fila.querySelector(".sn"), ikg = fila.querySelector(".kg"),
        irp = fila.querySelector(".rp"), ok = fila.querySelector(".ok");
    sn.textContent = i;
    ikg.setAttribute("aria-label", "Peso en kg, serie " + i + " de " + o.n);
    irp.setAttribute("aria-label", "Repeticiones, serie " + i + " de " + o.n);
    ok.setAttribute("aria-label", "Marcar serie " + i + " de " + o.n);

    ok.addEventListener("click", function(){
      var hecha = ok.getAttribute("aria-pressed") === "true";
      if(hecha){
        var s = sesionDelDia(o.day, false);
        if(s) Nube.desmarcarSerie(s, {ejercicio:o.badge, slot:o.slot, n_serie:i});
        cerrarSiProcede(o.day);
      } else {
        var antes = foto();
        var ses = sesionDelDia(o.day, true);
        Nube.marcarSerie(ses, {
          ejercicio:o.badge, slot:o.slot, n_serie:i,
          variante: o.variante(), peso:num(ikg.value), reps:num(irp.value)
        });
        flotaXP(ok, "+10 XP");
        vibrar(18);
        cerrarSiProcede(o.day);
        celebrar(antes);
        arrancarDescanso(o.rest);
      }
      repintarFichas(el, o);
      marcador();
    });

    [ikg, irp].forEach(function(inp){
      inp.addEventListener("keydown", function(e){ if(e.key === "Enter") ok.click(); });
    });
    return fila;
  }

  /* Refleja en la ficha lo que ya esta guardado: valores, vistos y si el
     ejercicio esta terminado. Se llama al construir y tras cada cambio. */
  function repintarFichas(el, o){
    pintarUltima(el, o);
    var filas = [].slice.call(el.querySelectorAll(".serie"));
    filas.forEach(function(fila, idx){
      var n = idx + 1;
      var g = serieMarcada(o.day, o.badge, o.slot, n);
      var ikg = fila.querySelector(".kg"), irp = fila.querySelector(".rp"),
          ok = fila.querySelector(".ok");
      if(g){
        ok.setAttribute("aria-pressed", "true");
        fila.classList.add("hecha");
        ikg.value = g.peso != null ? String(g.peso).replace(".", ",") : "";
        irp.value = g.reps != null ? String(g.reps) : "";
      } else {
        ok.setAttribute("aria-pressed", "false");
        fila.classList.remove("hecha");
        if(fila.classList.contains("sugerida")){ ikg.value = ""; irp.value = ""; fila.classList.remove("sugerida"); }
        if(!ikg.value && !irp.value){
          var u = ultimaDe(o.badge, o.variante ? o.variante() : null, n);
          if(u){
            ikg.value = u.peso != null ? String(u.peso).replace(".", ",") : "";
            irp.value = u.reps != null ? String(u.reps) : "";
            fila.classList.add("sugerida");
          }
        }
      }
    });
    var todas = filas.length > 0 && filas.every(function(f){
      return f.querySelector(".ok").getAttribute("aria-pressed") === "true";
    });
    el.classList.toggle("done", todas);
  }

  /* Marcas del dia anterior con este movimiento, encima de las series.
     Prerrellenar los campos ya ayuda, pero no deja ver la sesion entera:
     con esto sabes si la vez pasada aguantaste el peso hasta la ultima. */
  function pintarUltima(el, o){
    var caja = el.querySelector(".ultima");
    if(!caja) return;
    var ses = sesionDelDia(o.day, false);
    var u = ultimaSesionDe(o.badge, o.variante ? o.variante() : null, ses ? ses.id : null);
    if(!u || !u.series.length){ caja.hidden = true; caja.innerHTML = ""; return; }
    caja.hidden = false;
    caja.innerHTML = '<span class="uf"></span><span class="us"></span>';
    caja.querySelector(".uf").textContent = "Última vez · " + dia_mes(u.fecha);
    caja.querySelector(".us").textContent = u.series.map(function(x){
      return kg(x.peso) + "×" + (x.reps != null ? x.reps : "?");
    }).join("   ");
  }

  /* Una sesion cuenta al llegar al 70% de las series previstas. Se mide
     contra el plan guardado en la propia sesion, no contra el de hoy:
     si no, anadir un ejercicio al plan invalidaria sesiones ya hechas. */
  function cerrarSiProcede(dia){
    var s = sesionDelDia(dia, false);
    if(!s) return;
    var hechas = seriesDelDia(dia).length;
    var debe = Juego.sesionCompleta(hechas, s.series_plan || totalSeries(dia));
    if(s.completada !== debe){
      Nube.cerrarSesion(s, debe);
      if(debe) brindis("sesion", "✅", "Sesión completada", hechas + " series registradas", "+50");
    }
  }

  /* Repasa las sesiones guardadas por si la regla cambio despues de
     hacerlas, o por si el plan crecio y las dejo fuera injustamente. */
  function revisarSesiones(){
    var st = Nube.get(), cuenta = {}, tocadas = 0;
    st.series.forEach(function(x){ cuenta[x.sesion] = (cuenta[x.sesion] || 0) + 1; });
    st.sesiones.forEach(function(s){
      var debe = Juego.sesionCompleta(cuenta[s.id] || 0, s.series_plan || 0);
      if(s.completada !== debe){ s.completada = debe; tocadas++;
        Nube.cerrarSesion(s, debe); }
    });
    return tocadas;
  }

  /* ------------------------------------------------------------- construir */

  function buildDay(target, plan, day){
    var host = $(target);
    host.innerHTML = "";
    plan.forEach(function(p, idx){
      var b = EX[p.id];
      host.appendChild(card({
        badge: p.id, slot: idx, day: day, rest: restDe(p.id),
        n: b.n, q: b.q, c: b.c, alts: b.alts,
        reps: p.reps, sets: p.sets, nota: p.nota
      }));
    });
  }
  function buildSimple(target, arr){
    var host = $(target);
    host.innerHTML = "";
    arr.forEach(function(a, i){
      host.appendChild(card({badge:String(i+1), slot:i, day:"d1", n:a.n, q:a.q, c:a.c, reps:a.reps, sets:0}));
    });
  }

  function buildPicker(){
    var host = $("daypick");
    host.innerHTML = "";
    ABR.forEach(function(d,i){
      var b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = d;
      b.setAttribute("aria-pressed", i === refDay ? "true" : "false");
      b.addEventListener("click", function(){ refDay = i; buildPicker(); week(); });
      host.appendChild(b);
    });
  }
  function week(){
    var host = $("week");
    host.innerHTML = "";
    var partido = modo === "conPartido";
    var d2 = partido ? refDay : (refDay + 3) % 7;
    var d1 = partido ? (refDay - 3 + 7) % 7 : refDay;
    for(var i = 0; i < 7; i++){
      var cls = "", title = "Descanso", sub = "Nada. El descanso es parte del plan.";
      if(i === d1){ cls = "hot"; title = "Día 1 — Fuerza completa"; sub = "Peso muerto, prensa, empujes y tirones. RIR 2–3."; }
      else if(i === d2){
        cls = "ball";
        title = partido ? "Día 2 + Fútbol sala" : "Día 2 — Piernas y cardio";
        sub = partido ? "Tren superior y core, y 1 h de partido." : "Bisagra, unilateral, tirones y 8–10 min de intervalos.";
      }
      else if(i === (d1 + 1) % 7 || i === (d2 + 1) % 7){
        title = "Recuperación";
        sub = partido ? "Caminar 30–40 min, suave." : "Caminar o bici 25–30 min, suave.";
      }
      var row = document.createElement("div");
      row.className = "day " + cls;
      row.innerHTML = '<div class="d">' + ABR[i] + '</div><div class="t"><b></b><span></span></div>';
      row.querySelector("b").textContent = title;
      row.querySelector("span").textContent = sub;
      host.appendChild(row);
    }
  }

  function render(){
    var p = PLAN[modo], partido = modo === "conPartido";
    $("eyebrow").textContent = p.eyebrow;
    $("sub").textContent = p.sub;
    $("lead-d1").textContent = p.leadD1;
    $("final-d1").textContent = p.finalD1;
    $("lead-d2").textContent = p.leadD2;
    $("t-d2").textContent = p.tabD2;
    $("lead-sem").textContent = p.leadSem;
    $("pick-k").textContent = p.pickK;
    $("why-sem").textContent = p.whySem;
    $("bloque-partido").hidden = !partido;
    $("bloque-sinpartido").hidden = partido;

    buildDay("list-d1", p.d1, "d1");
    buildDay("list-d2", p.d2, "d2");
    buildSimple("list-prev-d1", PREV);
    buildSimple("list-prev-d2", PREV);
    if(partido) buildSimple("list-cal", CAL);
    buildSimple("list-mov", MOV);
    buildPicker(); week(); marcador(); hud(); progreso();
  }

  /* ------------------------------------------------------------- marcador */

  function diaActual(){
    return $("t-d2").getAttribute("aria-selected") === "true" ? "d2" : "d1";
  }
  function marcador(){
    var d = diaActual();
    $("scoreK").textContent = (d === "d2" ? "Día 2" : "Día 1") + " · series";
    $("scoreV").textContent = seriesDelDia(d).length + "/" + totalSeries(d);
  }

  /* HUD de cabecera: nivel, racha y XP. Se ve desde cualquier pestana. */
  function hud(){
    var st = Nube.get(), x = Juego.xp(st), n = Juego.nivel(x), r = Juego.racha(st.sesiones);
    var h = $("hud");
    h.innerHTML =
      '<span class="hchip"><b></b><i></i></span>' +
      '<span class="hchip"><b></b><i></i></span>' +
      '<span class="hchip"><b></b><i></i></span>';
    var c = h.querySelectorAll(".hchip");
    c[0].querySelector("b").textContent = "Nv " + n.n;
    c[0].querySelector("i").textContent = n.nombre;
    c[1].querySelector("b").textContent = "🔥 " + r.actual;
    c[1].querySelector("i").textContent = r.actual === 1 ? "semana" : "semanas";
    c[2].querySelector("b").textContent = x.toLocaleString("es-ES");
    c[2].querySelector("i").textContent = "XP";
  }

  /* ------------------------------------------------------------- progreso */

  function progreso(){
    var host = $("prog");
    if(!host) return;
    var st = Nube.get(), x = Juego.xp(st), n = Juego.nivel(x);
    var r = Juego.racha(st.sesiones), recs = Juego.records(st.series);
    var sesiones = st.sesiones.filter(function(s){ return s.completada; }).length;
    var vol = Juego.volumen(st.series);
    var ganados = {};
    st.logros.forEach(function(l){ ganados[l.clave] = l.fecha; });
    host.innerHTML = "";

    /* Nivel */
    var nv = document.createElement("div");
    nv.className = "panel nivel";
    nv.innerHTML =
      '<div class="nvTop"><span class="nvN"></span><span class="nvNom"></span></div>' +
      '<div class="barra"><span></span></div>' +
      '<p class="nvPie"></p>';
    nv.querySelector(".nvN").textContent = "Nivel " + n.n;
    nv.querySelector(".nvNom").textContent = n.nombre;
    nv.querySelector(".barra span").style.width = n.pct + "%";
    nv.querySelector(".nvPie").textContent = n.hasta == null
      ? x.toLocaleString("es-ES") + " XP · nivel máximo"
      : x.toLocaleString("es-ES") + " XP · faltan " + n.falta.toLocaleString("es-ES") + " para " + Juego.NIVELES[n.n].nombre;
    host.appendChild(nv);

    /* Cifras */
    var cif = document.createElement("div");
    cif.className = "cifras";
    [["🔥", r.actual, r.actual === 1 ? "semana de racha" : "semanas de racha"],
     ["📅", sesiones, sesiones === 1 ? "sesión" : "sesiones"],
     ["🏋️", st.series.length, "series"],
     ["⚖️", kg(vol / 1000) + " t", "movidos en total"]].forEach(function(c){
      var d = document.createElement("div");
      d.className = "cifra";
      d.innerHTML = '<span class="ci"></span><b></b><i></i>';
      d.querySelector(".ci").textContent = c[0];
      d.querySelector("b").textContent = c[1];
      d.querySelector("i").textContent = c[2];
      cif.appendChild(d);
    });
    host.appendChild(cif);

    var av = document.createElement("p");
    av.className = "note";
    var faltan = r.meta - r.estaSemana;
    av.textContent = r.estaSemana >= r.meta
      ? "Semana cumplida. La racha está a salvo."
      : "Llevas " + r.estaSemana + " de " + r.meta + " esta semana. " +
        (faltan === 1 ? "Te falta 1 sesión" : "Te faltan " + faltan + " sesiones") +
        " para no romper la racha.";
    host.appendChild(av);

    /* Logros */
    var h2 = document.createElement("h2");
    h2.textContent = "Logros · " + st.logros.length + "/" + Juego.LOGROS.length;
    host.appendChild(h2);
    var gl = document.createElement("div");
    gl.className = "logros";
    var ETIQ = {comun:"Común", rara:"Raro", epica:"Épico"};
    var orden = {epica:0, rara:1, comun:2};
    Juego.LOGROS.slice().sort(function(a, b){
      var ga = ganados[a.clave] ? 0 : 1, gb = ganados[b.clave] ? 0 : 1;
      return ga - gb || orden[b.rango] - orden[a.rango];
    }).forEach(function(l){
      var d = document.createElement("div");
      d.className = "logro " + (l.rango || "comun") + (ganados[l.clave] ? " on" : "");
      d.innerHTML = '<span class="li"></span><b></b><i></i><span class="lr"></span>';
      d.querySelector(".li").textContent = l.icono;
      d.querySelector("b").textContent = l.nombre;
      d.querySelector("i").textContent = l.desc;
      d.querySelector(".lr").textContent =
        ETIQ[l.rango || "comun"] + " · " + (Juego.XP_LOGRO[l.rango] || Juego.XP_LOGRO.comun) + " XP";
      gl.appendChild(d);
    });
    host.appendChild(gl);

    /* Records */
    var claves = Object.keys(recs).sort(function(a,b){
      return nombreMarca(recs[a]).localeCompare(nombreMarca(recs[b]), "es");
    });
    var h3 = document.createElement("h2");
    h3.textContent = "Tus marcas";
    host.appendChild(h3);
    if(!claves.length){
      var p = document.createElement("div");
      p.className = "note";
      p.textContent = "Aún no hay marcas. Apunta el peso y las repeticiones al marcar una serie y aparecerán aquí.";
      host.appendChild(p);
    } else {
      var tb = document.createElement("div");
      tb.className = "marcas";
      claves.forEach(function(k){
        var m = recs[k];
        var d = document.createElement("div");
        d.className = "marca";
        d.innerHTML = '<b></b><span class="mv"></span><i></i>';
        d.querySelector("b").textContent = nombreMarca(m);
        d.querySelector(".mv").textContent = kg(m.peso) + " kg × " + m.reps;
        d.querySelector("i").textContent = "1RM est. " + kg(m.e1rm) + " kg";
        tb.appendChild(d);
      });
      host.appendChild(tb);
    }

    host.appendChild(bloqueCuenta());
  }

  /* -------------------------------------------------------------- cuenta */

  function bloqueCuenta(){
    var caja = document.createElement("div");
    var h = document.createElement("h2");
    h.textContent = "Cuenta";
    caja.appendChild(h);

    var p = document.createElement("div");
    p.className = "panel cuenta";
    var m = Nube.modo(), pend = Nube.pendientes();

    if(m === "local"){
      p.innerHTML = '<p class="cEstado"></p>';
      p.querySelector(".cEstado").textContent =
        "Guardando solo en este navegador. Para sincronizar entre el móvil y el ordenador, " +
        "rellena config.js con los datos de tu proyecto de Supabase.";
    } else if(m === "conectado"){
      p.innerHTML = '<p class="cEstado"></p><button class="pill" type="button" id="salir">Cerrar sesión</button>';
      p.querySelector(".cEstado").textContent =
        "Sincronizado como " + Nube.email() + (pend ? " · " + pend + " pendientes de subir" : "");
      p.querySelector("#salir").addEventListener("click", function(){
        Nube.salir().then(function(){ render(); });
      });
    } else {
      p.innerHTML =
        '<p class="cEstado">Entra con tu correo y tus entrenos te siguen a cualquier dispositivo. ' +
        'Sin contraseña: recibes un enlace y listo.</p>' +
        '<div class="cForm"><input id="cMail" type="email" inputmode="email" autocomplete="email" placeholder="tu@correo.com">' +
        '<button class="pill" type="button" id="cEntrar">Entrar</button></div>' +
        '<p class="cAviso" id="cAviso" hidden></p>';
      var mail = p.querySelector("#cMail"), av = p.querySelector("#cAviso");
      if(Nube.email()) mail.value = Nube.email();
      p.querySelector("#cEntrar").addEventListener("click", function(){
        var dir = mail.value.trim();
        if(!dir){ av.hidden = false; av.textContent = "Escribe tu correo."; return; }
        av.hidden = false; av.textContent = "Enviando…";
        Nube.entrar(dir).then(function(){
          av.textContent = "Te he mandado un enlace a " + dir + ". Ábrelo en este mismo dispositivo.";
        }, function(e){
          av.textContent = "No se ha podido enviar: " + (e && e.message ? e.message : "revisa la configuración.");
        });
      });
      mail.addEventListener("keydown", function(e){ if(e.key === "Enter") p.querySelector("#cEntrar").click(); });
    }
    caja.appendChild(p);
    return caja;
  }

  /* --------------------------------------------------------------- modo */

  var mSi = $("m-si"), mNo = $("m-no");
  function setModo(m){
    modo = m;
    mSi.setAttribute("aria-pressed", m === "conPartido" ? "true" : "false");
    mNo.setAttribute("aria-pressed", m === "sinPartido" ? "true" : "false");
    refDay = m === "conPartido" ? 4 : 0;
    render();
  }
  mSi.addEventListener("click", function(){ setModo("conPartido"); });
  mNo.addEventListener("click", function(){ setModo("sinPartido"); });

  /* --------------------------------------------------------------- temas */

  var temaSel = $("temaSel"), temaBtn = $("temaBtn"), temaMenu = $("temaMenu"),
      temaOpts = [].slice.call(document.querySelectorAll(".temaOpt"));

  function abrirTema(open){
    temaMenu.hidden = !open;
    temaBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  temaBtn.addEventListener("click", function(e){ e.stopPropagation(); abrirTema(temaMenu.hidden); });
  /* La barra del navegador se pinta con theme-color. Si se queda fija en
     el gris del tema Grafito, con el tema Claro queda una franja oscura
     sobre una pagina clara. */
  var BARRA = {grafito:"#1A1F25", cal:"#E1E5E9", vino:"#2C0D15"};
  function pintarBarra(t){
    var m = document.querySelector('meta[name="theme-color"]');
    if(m && BARRA[t]) m.setAttribute("content", BARRA[t]);
  }

  temaOpts.forEach(function(b){
    b.addEventListener("click", function(){
      var t = b.getAttribute("data-t");
      document.documentElement.setAttribute("data-tema", t);
      pintarBarra(t);
      try { localStorage.setItem("sp:tema", t); } catch(e){}
      temaOpts.forEach(function(o){ o.setAttribute("aria-checked", o === b ? "true" : "false"); });
      abrirTema(false);
      temaBtn.focus();
    });
  });
  document.addEventListener("click", function(e){
    if(!temaMenu.hidden && !temaSel.contains(e.target)) abrirTema(false);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !temaMenu.hidden){ abrirTema(false); temaBtn.focus(); }
  });
  (function temaGuardado(){
    var t;
    try { t = localStorage.getItem("sp:tema"); } catch(e){}
    if(!t) return;
    document.documentElement.setAttribute("data-tema", t);
    pintarBarra(t);
    temaOpts.forEach(function(o){ o.setAttribute("aria-checked", o.getAttribute("data-t") === t ? "true" : "false"); });
  })();

  /* ------------------------------------------------------------ pestanas */

  var tabs = [].slice.call(document.querySelectorAll(".tab"));
  tabs.forEach(function(t){
    t.addEventListener("click", function(){
      tabs.forEach(function(o){
        var sel = o === t;
        o.setAttribute("aria-selected", sel ? "true" : "false");
        $(o.getAttribute("aria-controls")).hidden = !sel;
      });
      window.scrollTo({top:0, behavior:"smooth"});
      marcador();
      if(t.id === "t-prog") progreso();
    });
  });

  /* ----------------------------------------------------------- cronometro */

  var lens = [60,90,120], li = 1, left = 90, tick = null;
  var clock = $("clock"), startB = $("tStart"), setB = $("tSet");
  function fmt(s){ return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); }
  function paintClock(){ clock.textContent = fmt(left); }
  function stopTimer(){ if(tick) clearInterval(tick); tick = null; clock.classList.remove("run"); startB.textContent = "Descanso"; }
  function arrancarDescanso(secs){
    stopTimer();
    if(typeof secs === "number"){
      var i = lens.indexOf(secs);
      if(i >= 0){ li = i; setB.textContent = fmt(secs); }
      left = secs;
    } else {
      left = lens[li];
    }
    paintClock();
    clock.classList.add("run"); startB.textContent = "Parar";
    tick = setInterval(function(){
      left--; paintClock();
      if(left <= 0){ stopTimer(); left = lens[li]; paintClock(); if(navigator.vibrate) navigator.vibrate([180,90,180]); }
    }, 1000);
  }
  startB.addEventListener("click", function(){ tick ? (stopTimer(), left = lens[li], paintClock()) : arrancarDescanso(); });
  setB.addEventListener("click", function(){
    li = (li + 1) % lens.length; setB.textContent = fmt(lens[li]);
    if(!tick){ left = lens[li]; paintClock(); }
  });
  setB.textContent = fmt(lens[li]); paintClock();

  /* -------------------------------------------------------------- arranque */

  Nube.alCambiar(function(){ hud(); marcador(); });
  revisarSesiones();
  render();
  Nube.init().then(function(){ revisarSesiones(); render(); });
})();
