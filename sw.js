/* Control de actualizaciones y funcionamiento sin cobertura.

   Sin esto, la web app del icono depende de la cache HTTP de iOS, que es
   distinta a la de Safari y no tiene forma de recargarse a la fuerza: se
   quedaba clavada en una version vieja durante dias.

   Estrategia: red primero. Siempre se intenta la version de arriba, y la
   cache solo entra si no hay red. Asi una cache mal poblada nunca deja la
   app atascada, que es el riesgo real de un service worker. */

var VERSION = "sp-26";
var CACHE = "segunda-parte-" + VERSION;
var CONCHA = [
  "./", "./index.html", "./config.js",
  "./js/datos.js", "./js/juego.js", "./js/nube.js", "./js/respaldo.js", "./js/app.js",
  "./favicon.svg", "./site.webmanifest", "./icons/icon-192.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(CONCHA); })
      /* Que la version nueva entre sin esperar a que se cierren todas las
         pestanas: en una web app puede no cerrarse nunca. */
      .then(function(){ return self.skipWaiting(); })
      .catch(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){
        return k !== CACHE ? caches.delete(k) : null;
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var pet = e.request;
  if(pet.method !== "GET") return;
  var url;
  try { url = new URL(pet.url); } catch(err){ return; }
  /* Fuentes de Google y supabase-js: que los gestione el navegador. */
  if(url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(pet).then(function(res){
      if(res && res.ok){
        var copia = res.clone();
        caches.open(CACHE).then(function(c){ c.put(pet, copia); }).catch(function(){});
      }
      return res;
    }).catch(function(){
      /* Sin red: lo guardado. ignoreSearch para que el ?v=N no impida
         encontrar el fichero que ya tenemos. */
      return caches.match(pet, {ignoreSearch:true}).then(function(hit){
        return hit || caches.match("./index.html", {ignoreSearch:true});
      });
    })
  );
});

/* La app puede pedir la version para ensenarla y poder diagnosticar. */
self.addEventListener("message", function(e){
  if(e.data === "version" && e.source) e.source.postMessage({version:VERSION});
});
