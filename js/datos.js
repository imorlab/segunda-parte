/* Datos del plan: ejercicios, rutinas, calentamiento y movilidad.
   Solo contenido. Sin logica ni DOM. */

var EX = {
  "01": {n:"Trap Bar Deadlift", q:"trap bar deadlift tecnica correcta", c:[
      "Barra a media espinilla, tibias casi verticales, pecho alto.",
      "Empuja el suelo con los pies en vez de tirar con la espalda.",
      "Si la lumbar se redondea, la serie ha terminado."],
    alts:[
      {n:"Peso muerto con mancuernas desde bloques", q:"peso muerto con mancuernas tecnica", c:[
        "Mancuernas a los lados, sobre discos para acortar el recorrido.",
        "Misma idea: cadera atrás, espalda neutra."]},
      {n:"Hip thrust en máquina", q:"hip thrust maquina tecnica gluteo", c:[
        "Cero carga en la columna, todo glúteo e isquio.",
        "Aprieta arriba 1 s, sin arquear la lumbar."]},
      {n:"Rack pull", q:"rack pull tecnica peso muerto parcial", c:[
        "Barra a la altura de la rodilla en el rack.",
        "Menos rango, misma fuerza de espalda."]}
    ]},
  "02": {n:"Press inclinado con mancuernas", q:"press inclinado con mancuernas tecnica", c:[
      "Banco a 30°, no más: por encima trabaja el hombro, no el pecho.",
      "Codos a unos 45° del torso, nunca abiertos en cruz.",
      "Escápulas atrás y abajo, pecho alto todo el rato."],
    alts:[
      {n:"Press de pecho en máquina", q:"press de pecho maquina tecnica", c:[
        "Trayectoria guiada: puedes acercarte al fallo con seguridad.",
        "Ideal si entrenas solo o el hombro está sensible."]},
      {n:"Press plano con mancuernas", q:"press banca plano con mancuernas tecnica", c:[
        "Más pecho bajo, menos hombro.",
        "Sube en curva hacia el centro, no recto."]},
      {n:"Fondos en máquina asistida", q:"fondos paralelas asistidos maquina tecnica", c:[
        "Torso algo inclinado, codos cerca del cuerpo.",
        "Con 110 kg, siempre con asistencia al principio."]}
    ]},
  "03": {n:"Remo con pecho apoyado", q:"remo con pecho apoyado banco inclinado tecnica", c:[
      "Pecho pegado al banco: si te separas, estás usando la cadera.",
      "Codos hacia la cadera y aprieta un segundo arriba.",
      "Tu mejor ejercicio de espalda: cero carga lumbar."],
    alts:[
      {n:"Remo sentado en máquina", q:"remo sentado en maquina tecnica espalda", c:[
        "Pecho contra el soporte, sin balancear el torso.",
        "Más fácil de progresar en peso."]},
      {n:"Remo a una mano con mancuerna", q:"remo con mancuerna una mano apoyado banco tecnica", c:[
        "Rodilla y mano en el banco, espalda paralela al suelo.",
        "Corrige asimetrías entre lados."]},
      {n:"Remo en polea baja", q:"remo en polea baja sentado tecnica", c:[
        "Tensión constante en todo el recorrido.",
        "Que no acabe tirando la lumbar."]}
    ]},
  "04": {n:"Prensa de piernas", q:"prensa de piernas tecnica correcta rango", c:[
      "Baja hasta acercar el muslo al torso sin despegar la pelvis.",
      "Rodillas alineadas con los pies, sin caer hacia dentro.",
      "No bloquees las rodillas de golpe arriba."],
    alts:[
      {n:"Hack squat", q:"hack squat maquina tecnica", c:[
        "Más parecido a la sentadilla, con la espalda apoyada.",
        "Empieza ligero: el rango es más exigente que en prensa."]},
      {n:"Prensa a una pierna", q:"prensa de piernas una pierna unilateral tecnica", c:[
        "La mitad del peso, el doble de valor para la pista.",
        "En fútbol sala casi todo pasa sobre una sola pierna."]},
      {n:"Sentadilla goblet a cajón", q:"goblet squat cajon tecnica", c:[
        "Mancuerna al pecho, te sientas y te levantas del cajón.",
        "Enseña el patrón sin castigar la espalda."]}
    ]},
  "05": {n:"Jalón al pecho", q:"jalon al pecho tecnica correcta dorsal", c:[
      "Barra al pecho, nunca a la nuca. Torso ligeramente atrás y firme.",
      "Piensa en llevar los codos a los bolsillos.",
      "Subida controlada: media serie que casi todos regalan."],
    alts:[
      {n:"Jalón con agarre neutro", q:"jalon agarre neutro paralelo tecnica", c:[
        "Palmas enfrentadas: más amable con hombro y codo."]},
      {n:"Dominadas asistidas en máquina", q:"dominadas asistidas maquina tecnica", c:[
        "Mismo patrón con tu peso descontado.",
        "Progresa quitando asistencia."]},
      {n:"Pull-over en polea alta", q:"pull over en polea alta dorsal tecnica", c:[
        "Brazos casi rectos, solo dorsal.",
        "Buen recambio si el codo se queja."]}
    ]},
  "06": {n:"Press de hombros con mancuernas", q:"press militar con mancuernas sentado tecnica", c:[
      "Sentado con respaldo, costillas abajo, sin arquear la lumbar.",
      "Mancuernas a la altura de las orejas al bajar.",
      "Si el hombro molesta, gira las palmas hacia dentro."],
    alts:[
      {n:"Press de hombros en máquina", q:"press de hombros en maquina tecnica", c:[
        "Trayectoria fija: más carga con menos riesgo."]},
      {n:"Landmine press", q:"landmine press hombro tecnica", c:[
        "Barra en ángulo: plano más cómodo para el hombro."]},
      {n:"Elevaciones laterales", q:"elevaciones laterales mancuernas tecnica", c:[
        "Poco peso, buen control.",
        "Solo si hoy el hombro no aguanta un press."]}
    ]},
  "07": {n:"Farmer Walk", q:"farmer walk tecnica agarre core", c:[
      "Camina alto, hombros atrás, sin inclinarte a un lado.",
      "Pasos cortos y firmes. Respira.",
      "Core y agarre: el fútbol sala te lo agradecerá."],
    alts:[
      {n:"Suitcase carry (una mano)", q:"suitcase carry ejercicio core tecnica", c:[
        "Una sola mancuerna: el core pelea para que no te inclines.",
        "Baja el peso a la mitad."]},
      {n:"Encogimientos con mancuernas", q:"encogimientos de hombros mancuernas tecnica", c:[
        "Si no puedes caminar con peso en tu gimnasio.",
        "Arriba y abajo, sin rotar los hombros."]},
      {n:"Paseo con trineo", q:"sled push arrastre trineo tecnica", c:[
        "Cardio y piernas sin impacto ni fase excéntrica.",
        "Nunca antes del partido."]}
    ]},
  "08": {n:"Pallof Press", q:"pallof press tecnica core antirotacion", c:[
      "Es antirrotación: el objetivo es que el torso NO gire.",
      "Extiende los brazos despacio y aguanta 2 s fuera.",
      "Glúteos activos, costillas abajo."],
    alts:[
      {n:"Plancha sobre codos", q:"plancha abdominal sobre codos tecnica correcta", reps:"3 × 20–40 s", c:[
        "Codos bajo los hombros, glúteos apretados, pelvis metida.",
        "Línea recta: sin culo arriba ni lumbar hundida.",
        "Si pasas de 45 s, no añadas tiempo: sube una pierna o pon peso."]},
      {n:"Dead bug", q:"dead bug ejercicio core tecnica", reps:"2 × 8 /lado", c:[
        "Lumbar pegada al suelo todo el rato. Ese es el ejercicio.",
        "Baja brazo y pierna contrarios despacio."]},
      {n:"Plancha lateral", q:"plancha lateral tecnica correcta", reps:"2 × 20–30 s /lado", c:[
        "Cadera alta, cuerpo alineado.",
        "Lateral del tronco: clave para frenar y girar."]}
    ]},
  /* Refuerzos que solo aparecen en semanas sin partido */
  "09": {n:"Peso muerto rumano con mancuernas", q:"peso muerto rumano mancuernas tecnica", c:[
      "Bisagra de cadera: culo atrás, rodillas casi fijas.",
      "Baja hasta notar el isquio, no hasta el suelo.",
      "El isquio fuerte es lo que te protege del tirón en el sprint."],
    alts:[
      {n:"Hip thrust en máquina", q:"hip thrust maquina tecnica gluteo", c:["Cero carga lumbar, todo glúteo.","Aprieta 1 s arriba."]},
      {n:"Curl femoral en máquina", q:"curl femoral tumbado maquina tecnica", c:["Aislado y seguro.","Fase de bajada lenta, 3 s."]},
      {n:"Peso muerto rumano con barra", q:"peso muerto rumano barra tecnica", c:["Más carga posible, más exigencia técnica.","Solo si la espalda va fina."]}
    ]},
  "10": {n:"Zancadas caminando", q:"zancadas caminando tecnica correcta", reps:"2 × 8 /lado", c:[
      "Paso largo, torso vertical, rodilla de atrás casi al suelo.",
      "Sin peso las primeras semanas: con 110 kg ya llevas carga de sobra.",
      "Esto es lo que te prepara para frenar y arrancar en pista."],
    alts:[
      {n:"Step-up al cajón", q:"step up al cajon tecnica correcta", reps:"2 × 8 /lado", c:[
        "Cajón a la altura de la rodilla o menos.",
        "Sube empujando con la pierna de arriba, no con un impulso."]},
      {n:"Sentadilla búlgara asistida", q:"sentadilla bulgara tecnica correcta", reps:"2 × 8 /lado", c:[
        "Agárrate a algo para el equilibrio y baja controlado."]},
      {n:"Prensa a una pierna", q:"prensa de piernas una pierna unilateral tecnica", reps:"2 × 10 /lado", c:[
        "La opción más segura si las rodillas están sensibles."]}
    ]},
  "11": {n:"Cardio: intervalos suaves", q:"intervalos bici estatica principiantes rutina", reps:"8–10 min", c:[
      "Bici o remo: 40 s a ritmo fuerte / 80 s suave, 4–5 rondas.",
      "\"Fuerte\" es no poder mantener una conversación, no reventarte.",
      "Sin partido, este es el hueco que tienes que tapar."],
    alts:[
      {n:"Caminata en cinta con inclinación", q:"caminar cinta inclinacion cardio", reps:"15 min", c:[
        "Inclinación 8–10%, ritmo cómodo. Cero impacto.",
        "La opción más amable con las rodillas."]},
      {n:"Elíptica continua", q:"eliptica tecnica cardio principiantes", reps:"12–15 min", c:[
        "Ritmo constante en el que puedas hablar con frases cortas."]},
      {n:"Remo continuo", q:"remo maquina tecnica correcta cardio", reps:"10 min", c:[
        "Piernas primero, luego tronco y brazos.",
        "Suma espalda al trabajo cardiovascular."]}
    ]}
};

var PLAN = {
  conPartido: {
    d1: [{id:"01",sets:3,reps:"3 × 6–8"},{id:"02",sets:3,reps:"3 × 8–10"},{id:"03",sets:3,reps:"3 × 8–12"},
         {id:"04",sets:3,reps:"3 × 8–12"},{id:"05",sets:2,reps:"2 × 10–12"},{id:"08",sets:2,reps:"2 × 10–12 /lado"}],
    d2: [{id:"06",sets:3,reps:"3 × 8–10"},{id:"05",sets:3,reps:"3 × 8–12"},
         {id:"02",sets:3,reps:"3 × 8–12",nota:"Variante plana o en máquina"},
         {id:"03",sets:2,reps:"2 × 10–12"},{id:"07",sets:2,reps:"2 × 30–40 s"},{id:"08",sets:2,reps:"2 × 10 /lado"}],
    eyebrow:"2 sesiones · 1 partido",
    sub:"El gimnasio construye piernas y espalda. El fútbol sala es el finisher.",
    leadD1:"Día fuerte. Fuerza de verdad dejando 2–3 repeticiones en el depósito (RIR 2–3). Descanso 2–3 min en los básicos.",
    finalD1:"8 min de bici o remo, moderado. Debes poder hablar mientras lo haces. No es un intervalo, es riego sanguíneo.",
    leadD2:"Mismo día que el partido. Tren superior y core. Las piernas ya tienen trabajo esperándolas en la pista.",
    tabD2:"Día 2 + ⚽",
    leadSem:"Elige el día del partido: el día fuerte cae 3 días antes.",
    pickK:"Juego el",
    whySem:"El fútbol sala no es \"un día de cardio\". Acelerar, frenar, girar y saltar con 110 kg es mucha carga mecánica. El gimnasio construye glúteo, isquio, cuádriceps, espalda y core sin que llegues al partido con las piernas fundidas."
  },
  sinPartido: {
    d1: [{id:"01",sets:3,reps:"3 × 6–8"},{id:"02",sets:3,reps:"3 × 8–10"},{id:"03",sets:3,reps:"3 × 8–12"},
         {id:"04",sets:3,reps:"3 × 10–12",nota:"Un poco más de repeticiones, sin partido que respetar"},
         {id:"05",sets:2,reps:"2 × 10–12"},{id:"08",sets:2,reps:"2 × 10–12 /lado"}],
    d2: [{id:"06",sets:3,reps:"3 × 8–10"},{id:"09",sets:3,reps:"3 × 8–10"},{id:"05",sets:3,reps:"3 × 8–12"},
         {id:"10",sets:2,reps:"2 × 8 /lado"},{id:"02",sets:2,reps:"2 × 8–12",nota:"Variante plana o en máquina"},
         {id:"03",sets:2,reps:"2 × 10–12"},{id:"08",sets:2,reps:"2 × 10 /lado"},{id:"11",sets:1,reps:"8–10 min"}],
    eyebrow:"Pretemporada · 2 sesiones completas",
    sub:"Sin partidos, el gimnasio asume todo: piernas completas y el cardio que antes ponía la pista.",
    leadD1:"Día fuerte. Igual que en semana de partido, pero sin necesidad de guardar nada para el viernes. RIR 2–3.",
    finalD1:"8 min de bici o remo, moderado. Y si te sobra tiempo, mejor movilidad que más cardio.",
    leadD2:"Sin partido, este día cambia de trabajo: entra bisagra de cadera, trabajo a una pierna y cardio real al final.",
    tabD2:"Día 2",
    leadSem:"Elige el día del Día 1: el Día 2 cae 3 días después.",
    pickK:"Día 1 el",
    whySem:"Esta es la ventana buena. Sin partidos puedes cargar las piernas sin miedo y llegar a la vuelta de liga con base. En cuanto vuelvan los partidos, cambia el interruptor: la bisagra y el trabajo unilateral salen del Día 2, o llegarás a la pista con las piernas muertas."
  }
};

var CAL = [
  {n:"Trote muy suave", reps:"90 s", q:"trote suave calentamiento futbol sala", c:["Solo entrar en calor. Nada de ritmo."]},
  {n:"Movilidad de tobillo", reps:"10 /lado", q:"movilidad de tobillo pared calentamiento", c:["Rodilla al frente sin despegar el talón.","Clave para frenar y girar en pista."]},
  {n:"Movilidad de cadera", reps:"8 /lado", q:"movilidad de cadera dinamica calentamiento futbol", c:["Círculos y aperturas amplias, sin forzar."]},
  {n:"Balanceos de piernas", reps:"10 /lado", q:"balanceos de piernas calentamiento dinamico", c:["Adelante-atrás y lateral, agarrado a la portería."]},
  {n:"Aceleraciones progresivas", reps:"2–3 × 15 m", q:"aceleraciones progresivas calentamiento futbol sala", c:["La primera al 60%, la última al 85%. Nunca al 100% en frío."]}
];

var MOV = [
  {n:"Movilidad de tobillo en pared", reps:"2 × 10 /lado", q:"movilidad dorsiflexion tobillo pared ejercicio", c:["La rodilla toca la pared con el talón clavado.","Poco tobillo = rodilla y cadera pagando la factura."]},
  {n:"Elevación de talones excéntrica", reps:"2 × 12", q:"elevacion de talones excentrica gemelo soleo", c:["Sube con dos piernas, baja despacio con una.","Protege el tendón de Aquiles."]},
  {n:"90/90 de cadera", reps:"2 × 8 /lado", q:"ejercicio 90 90 movilidad cadera", c:["Cambios de lado lentos, sentado en el suelo.","Rotación interna y externa: los giros del partido."]},
  {n:"Sentadilla profunda asistida", reps:"3 × 20 s", q:"sentadilla profunda asistida movilidad", c:["Agarrado a algo para no compensar. Respira abajo."]},
  {n:"Equilibrio a una pierna", reps:"2 × 30 s /lado", q:"equilibrio monopodal propiocepcion tobillo ejercicio", c:["Progresa cerrando los ojos.","Lo que evita el esguince tonto."]}
];
