/* Supabase de mentira para las pruebas, lo bastante fiel como para que
   los fallos que costaron datos se puedan reproducir aqui:
   respeta claves unicas, claves ajenas, columnas generadas, paginacion
   y latencia. Si el cliente hace algo que Postgres rechazaria, aqui
   tambien falla. */
function crearServidorFalso(opciones){
  opciones = opciones || {};
  var tablas = {sesion:[], serie:[], logro:[]};
  var UNICA = {sesion:["usuario","fecha","dia"],
               serie:["sesion","ejercicio","slot","n_serie"],
               logro:["usuario","clave"]};
  var GENERADAS = {serie:["e1rm"]};
  var latencia = opciones.latencia == null ? 3 : opciones.latencia;
  var registro = [];

  function k(tabla, f){ return UNICA[tabla].map(function(c){ return String(f[c]); }).join("|"); }
  function tarde(v){ return new Promise(function(res){ setTimeout(function(){ res(v); }, latencia); }); }

  function upsert(tabla, fila, op){
    registro.push({tabla:tabla, fila:fila});
    if(opciones.antesDeUpsert){
      var e = opciones.antesDeUpsert(tabla, fila);
      if(e) return tarde({error:e});
    }
    var gen = (GENERADAS[tabla] || []).filter(function(c){ return fila[c] !== undefined; });
    if(gen.length) return tarde({error:{code:"428C9",
      message:'cannot insert a non-DEFAULT value into column "' + gen[0] + '"'}});

    if(tabla === "serie" && !tablas.sesion.some(function(s){ return s.id === fila.sesion; }))
      return tarde({error:{code:"23503", message:'insert or update on table "serie" violates foreign key constraint'}});

    if(tabla === "serie" && fila.reps != null && !Number.isInteger(fila.reps))
      return tarde({error:{code:"22P02", message:'invalid input syntax for type integer: "' + fila.reps + '"'}});
    if(tabla === "serie" && fila.peso != null && Math.abs(fila.peso) > 9999.99)
      return tarde({error:{code:"22003", message:"numeric field overflow"}});
    if(fila.usuario !== undefined && !/^[0-9a-f-]{36}$/.test(String(fila.usuario)))
      return tarde({error:{code:"22P02", message:'invalid input syntax for type uuid: "' + fila.usuario + '"'}});

    var natural = k(tabla, fila);
    var yaNatural = tablas[tabla].filter(function(f){ return k(tabla, f) === natural; })[0];
    var conflictoPorClaveNatural = op && op.onConflict && op.onConflict !== "id";

    if(yaNatural){
      if(!conflictoPorClaveNatural)
        return tarde({error:{code:"23505", message:"duplicate key value violates unique constraint"}});
      if(op.ignoreDuplicates) return tarde({error:null});
      // Reescribir el id de una sesion con series colgando: lo que rompia el FK.
      if(tabla === "sesion" && fila.id && fila.id !== yaNatural.id &&
         tablas.serie.some(function(x){ return x.sesion === yaNatural.id; }))
        return tarde({error:{code:"23503",
          message:'update or delete on table "sesion" violates foreign key constraint on "serie"'}});
      Object.keys(fila).forEach(function(c){ yaNatural[c] = fila[c]; });
      return tarde({error:null});
    }
    if(fila.id && tablas[tabla].some(function(f){ return f.id === fila.id; }))
      return tarde({error:{code:"23505", message:"duplicate key value violates unique constraint"}});
    tablas[tabla].push(JSON.parse(JSON.stringify(fila)));
    return tarde({error:null});
  }

  function consulta(tabla){
    var filtro = null;
    var api = {
      eq: function(c, v){ filtro = {c:c, v:v}; return api; },
      range: function(a, b){
        var f = tablas[tabla].filter(function(x){ return !filtro || x[filtro.c] === filtro.v; });
        return tarde({data: f.slice(a, b + 1), error:null});
      },
      order: function(){ 
        var f = tablas[tabla].filter(function(x){ return !filtro || x[filtro.c] === filtro.v; });
        return tarde({data: f, error:null});
      },
      then: function(fn){
        var f = tablas[tabla].filter(function(x){ return !filtro || x[filtro.c] === filtro.v; });
        return tarde({data: f, error:null}).then(fn);
      }
    };
    return api;
  }

  return {
    tablas: tablas,
    registro: registro,
    cliente: {
      auth: {
        onAuthStateChange: function(){},
        getSession: function(){ return Promise.resolve({data:{session: opciones.sesion || null}}); },
        signOut: function(){ return Promise.resolve({error:null}); }
      },
      from: function(tabla){
        return {
          upsert: function(fila, op){ return upsert(tabla, fila, op); },
          select: function(){ return consulta(tabla); },
          delete: function(){ return {eq: function(c, v){
            tablas[tabla] = tablas[tabla].filter(function(f){ return f[c] !== v; });
            return tarde({error:null});
          }};}
        };
      }
    }
  };
}
module.exports = {crearServidorFalso: crearServidorFalso};
