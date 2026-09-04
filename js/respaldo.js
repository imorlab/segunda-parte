/* Copia de seguridad manual del historial.

   La sincronizacion puede fallar y el navegador puede desalojar el
   almacenamiento sin avisar. Esto es la red de abajo: un fichero que te
   llevas tu y que no depende de que nada de lo anterior funcione.

   En una web app de iOS no hay descargas al uso, asi que se ofrecen tres
   salidas y se usa la primera que exista: hoja de compartir (guarda en
   Archivos o iCloud), portapapeles y descarga clasica. */

var Respaldo = (function(){
  "use strict";

  var VERSION = 1;

  function nombre(){
    var d = new Date();
    var p = function(n){ return String(n).padStart(2, "0"); };
    return "segunda-parte-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
           "-" + p(d.getHours()) + p(d.getMinutes()) + ".json";
  }

  function serializar(estado){
    return JSON.stringify({
      formato: "segunda-parte",
      version: VERSION,
      exportado: new Date().toISOString(),
      sesiones: estado.sesiones || [],
      series: estado.series || [],
      logros: estado.logros || []
    }, null, 1);
  }

  /* Devuelve una promesa con el metodo que acabo funcionando, para poder
     decirle al usuario donde ha ido a parar el fichero. */
  function exportar(estado){
    var texto = serializar(estado), fichero = nombre();

    if(navigator.canShare){
      try {
        var f = new File([texto], fichero, {type:"application/json"});
        if(navigator.canShare({files:[f]})){
          return navigator.share({files:[f], title:"Segunda Parte"})
            .then(function(){ return "compartido"; })
            .catch(function(e){
              /* Cancelar la hoja de compartir no es un error que reportar. */
              if(e && e.name === "AbortError") return "cancelado";
              return portapapeles(texto, fichero);
            });
        }
      } catch(e){}
    }
    return portapapeles(texto, fichero);
  }

  function portapapeles(texto, fichero){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(texto)
        .then(function(){ return "portapapeles"; })
        .catch(function(){ return descargar(texto, fichero); });
    }
    return Promise.resolve(descargar(texto, fichero));
  }

  function descargar(texto, fichero){
    try {
      var url = URL.createObjectURL(new Blob([texto], {type:"application/json"}));
      var a = document.createElement("a");
      a.href = url; a.download = fichero;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      return "descarga";
    } catch(e){ return "fallo"; }
  }

  /* Importar nunca borra: funde con lo que ya hay. Una restauracion que
     pise datos mas nuevos que los del fichero seria otra forma de
     perderlos. */
  function importar(texto, estado){
    var d;
    try { d = JSON.parse(texto); }
    catch(e){ throw new Error("El fichero no es un JSON valido."); }
    if(!d || d.formato !== "segunda-parte") throw new Error("Ese fichero no es un respaldo de Segunda Parte.");
    if(!Array.isArray(d.sesiones) || !Array.isArray(d.series)) throw new Error("El respaldo esta incompleto.");

    var res = {nuevas:{sesiones:0, series:0, logros:0}};
    var fundir = function(destino, origen, clave){
      var hay = {};
      destino.forEach(function(f){ hay[f[clave]] = true; });
      var n = 0;
      origen.forEach(function(f){
        if(f && f[clave] != null && !hay[f[clave]]){ destino.push(f); hay[f[clave]] = true; n++; }
      });
      return n;
    };
    res.nuevas.sesiones = fundir(estado.sesiones, d.sesiones, "id");
    res.nuevas.series   = fundir(estado.series,   d.series,   "id");
    res.nuevas.logros   = fundir(estado.logros,   d.logros || [], "clave");
    return res;
  }

  return {exportar:exportar, importar:importar, serializar:serializar, nombre:nombre};
})();
