import type { Guide, GuideLabels, GuidesIndex } from './guides';

/**
 * The guides in Spanish: the twin of guides.en.ts, with the same slugs, the
 * same programs, the same `facts` (service and keys stay in ENGLISH: they
 * are lookup keys), and the same sections, list items and questions in the
 * same order. Read the header of guides.ts before editing: no number typed
 * (the rows print them), nothing about who signs, no fee, no promise about
 * an office, and no block of six words that another page of the site
 * already prints (guides.test.ts). Vocabulary follows site.es.ts, but the
 * sentences are this file's own: even the long official names are written
 * around so that no six-word block repeats another page.
 */

export const labels: GuideLabels = {
  eyebrow: 'Guía',
  reviewed: 'Última revisión',
  rowsOf: (jurisdiction) => `De la fila de ${jurisdiction}`,
  factLabel: (county, label) => `${county} — ${label}`,
  questionsLabel: 'Preguntas',
  more: 'Hacia dónde seguir.',
  addressCta: 'Enviar la dirección',
  costLink: 'Lo que cuesta el trabajo',
  allGuides: 'Todas las guías',
  forProgram: 'Guías para dueños',
  shortLabel: 'En pocas palabras',
  serviceLabel: 'El servicio de esta guía',
  proposalCta: 'Solicitar propuesta',
};

export const index: GuidesIndex = {
  seo: {
    title: 'Guías para dueños de edificios en Florida',
    description:
      'Respuestas claras para dueños y juntas en Florida: notificaciones del condado, reglas de hito y threshold, balcones, comprar un edificio y revisión por pares.',
  },
  crumb: 'Guías',
  eyebrow: 'Guías',
  titleLines: ['Guías para dueños', 'de edificios en Florida.'],
  accentWord: 'en Florida.',
  sub: 'Respuestas breves y claras a las preguntas de dueños, juntas y administradores — una notificación del condado, la ley de hitos, un edificio alto, un balcón agrietado, una compra, un diseño por revisar — cada una con el servicio que la resuelve.',
  listLabel: 'Las guías',
  listTitle: 'Elija la pregunta que tiene hoy.',
  groups: [
    { label: 'Recertificación y BSIP', lede: 'Los dos programas de los condados: la carta, el plazo que abre, los nombres que usan los dueños y qué pasa cuando un informe enumera reparaciones.', services: ['building-recertification', 'broward-bsip'] },
    { label: 'Inspecciones de hito', lede: 'Lo que la ley estatal le pide a una junta de condominio o cooperativa, y cómo lo cubre el informe del condado.', services: ['milestone-inspections'] },
    { label: 'Edificios threshold', lede: 'Cuándo la altura o un gran salón de reunión ponen un edificio por encima del umbral, y qué pide entonces el condado.', services: ['threshold-inspections'] },
    { label: 'Evaluaciones y reparaciones', lede: 'Grietas, concreto desprendido y un edificio a punto de comprarse: qué mirar, y cuándo conviene que un ingeniero lo mire con usted.', services: ['structural-condition-assessments'] },
    { label: 'Revisión por pares', lede: 'Cuándo un diseño estructural necesita una segunda lectura independiente antes del permiso, y qué abarca esa lectura.', services: ['peer-review'] },
  ],
  howLabel: 'Su carta',
  howTitle: 'Su carta fija la fecha. Envíela y se la leemos.',
  how: [
    'Miami-Dade y Broward tienen cada uno su propio programa — sus edades, su plazo, sus formularios — y una fecha vencida en cualquiera de los dos pasa a la vía de cumplimiento del condado. Una regla de un condado nunca se aplica a un edificio del otro.',
    'Mándenos una foto de la notificación con su celular y le decimos a qué programa corresponde, qué pide la oficina y para cuándo, con una propuesta de precio fijo por el paquete completo. ¿Todavía sin carta? Envíe la dirección, y leemos el registro desde el cual el condado cuenta la edad del edificio.',
    'Una vez aprobada la propuesta, la inspección se programa para un día en que se pueda abrir el edificio, y el paquete completo llega entre tres y cuatro días después de esa visita, o entre uno y dos si la fecha está cerca. Un informe que enumera reparaciones se entrega a tiempo de todos modos.',
  ],
};

export const guides: Guide[] = [
  /* ── 1. The notice ─────────────────────────────────────────────────── */
  {
    slug: 'recertification-notice',
    service: 'building-recertification',
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: '¿Le llegó una notificación de recertificación?',
      description:
        'Llegó una carta de recertificación o del BSIP en Miami-Dade o Broward: los cinco primeros pasos, el plazo que abre y qué enviarle al ingeniero.',
    },
    name: 'Llegó la carta: primeros pasos',
    h1: 'Recibió una notificación de recertificación. Esto es lo primero que conviene hacer.',
    heroSub:
      'Una carta de su departamento de construcción pone a correr un plazo. Esto es lo que conviene hacer: léala ese mismo día y siga estos cinco pasos, esté el edificio en Miami-Dade o en Broward.',
    card: 'Para la junta o el dueño que tiene la carta en la mano: los cinco primeros pasos, en orden, y el plazo que empieza a correr.',
    short: ["La carta pone en marcha el plazo de su condado para presentar, y Broward lo cuenta a partir de su recepción.", "La semana en que llegue, mande la carta a un ingeniero, aunque sea como foto del celular, con planos e informes previos.", "Aunque enumere reparaciones, el informe se presenta dentro del plazo, y las reparaciones se hacen luego con permiso."],
    sections: [
      {
        title: 'Primero, lea lo que la carta dice en realidad',
        paras: [
          'La notificación es breve y está escrita para la oficina que la manda, no para el dueño que la abre. Antes que nada, busque en ella tres datos: qué oficina la mandó, la fecha de la carta o la fecha en que la recibió el edificio, y la fecha para la cual esa oficina espera el informe.',
          'En Miami-Dade se trata de la recertificación de edificios que exige el condado, y la carta llega de la oficina de construcción de su municipio, o del propio condado cuando el edificio queda en un área no incorporada. En Broward se trata del BSIP (Building Safety Inspection Program), y la carta llega del Building Official, el funcionario de construcción del municipio. Los propietarios llaman a ambos “la recertificación de 40 años”, nombre heredado de reglas anteriores; el plazo que trae la carta es el vigente.',
        ],
        list: [
          'Quién la mandó: la oficina del membrete es la misma a la que regresa el informe.',
          'Cuándo llegó: guarde el sobre. En Broward el tiempo para presentar corre a partir del día en que la notificación se recibe.',
          'La fecha que fija: si su municipio indica una fecha propia, es esa la que hay que tener en cuenta al planificar.',
        ],
      },
      {
        title: 'Cuánto tiempo le da la notificación',
        paras: [
          'Cada condado maneja su propio plazo, y nunca hay que leer uno con las reglas del otro. Abajo está el tiempo que las reglas de cada condado dan para presentar el informe, tal como se verificó en las páginas de los programas; el tiempo para las reparaciones posteriores está en la guía sobre recertificaciones no aprobadas. La fecha impresa en su propia carta es la que cuenta. ¿Ya pasó? Todavía tiene solución.',
        ],
        facts: [
          { service: 'building-recertification', keys: ['Time to file'] },
          { service: 'broward-bsip', keys: ['Time to file'] },
        ],
      },
      {
        title: 'Cinco pasos, en este orden',
        paras: [
          'Casi todos los problemas de una recertificación nacen de las semanas que se pierden al principio. Nada de esta lista toma mucho tiempo, y cada paso acorta el siguiente.',
        ],
        list: [
          'Mándele la carta a un ingeniero la misma semana en que llega. Con una foto hecha desde su celular ya se puede empezar a preparar una propuesta.',
          'Busque los planos de origen y el informe de inspección más reciente, si el edificio lo tiene. Acortan la inspección y hacen más exacta la propuesta.',
          'Si se trata de un condominio o una cooperativa con tres o más pisos habitables, avise a los dueños de cada unidad: la ley estatal le impone a la junta deberes propios, que se detallan en la página de cada programa de condado.',
          'Prevea un día de acceso: el techo, el garaje, los cuartos eléctricos y las unidades que pida ver el ingeniero.',
          'Separe dinero para reparaciones antes de saber cuánto serán. Primero se entrega el informe; las reparaciones, si las hay, llegan después, con permiso.',
        ],
      },
      {
        title: 'Qué pasa después de que nos llama',
        paras: [
          'Leemos la carta y los antecedentes del edificio, verificamos qué le pide su oficina y en qué plazo, y le enviamos una propuesta de precio fijo por el paquete completo que exige su condado: las inspecciones estructural y eléctrica y cada documento que las acompaña. La inspección se agenda según el día en que usted pueda abrir el edificio.',
          'El informe se entrega aunque enumere reparaciones: los dos condados lo quieren antes, no al terminar la obra. Si hacen falta reparaciones, su alcance se redacta para que todos los contratistas coticen lo mismo, y un informe enmendado cierra el expediente cuando quedan hechas.',
        ],
      },
    ],
    faqTitle: 'Lo que pregunta la junta al abrir la carta',
    faq: [
      {
        q: '¿Podemos esperar a que se acerque la fecha de la notificación?',
        a: 'Pueden, pero se gasta un tiempo que más tarde le hará falta. Una inspección contratada tarde no deja margen si el informe enumera reparaciones, y las reparaciones con permiso avanzan al ritmo del permiso, no al de la fecha límite.',
      },
      {
        q: 'La carta le llegó a la compañía administradora, no a la junta. ¿El plazo corre igual?',
        a: 'Dé por hecho que sí. La oficina mandó la notificación a la dirección que tiene registrada para el edificio; pásela a la junta ese mismo día y anote la fecha en que llegó.',
      },
      {
        q: '¿Necesitamos algo antes de pedir una propuesta?',
        a: 'Solo la carta. Con la dirección y la edad del edificio sabemos qué reglas de condado le aplican; los planos y el último informe ayudan, pero no hacen falta para empezar.',
      },
      {
        q: '¿La notificación es lo mismo que una infracción?',
        a: 'No. Una notificación avisa que el edificio alcanzó la edad a partir de la cual se exige una inspección. Las medidas de cumplimiento empiezan solo si el informe no se entrega a tiempo.',
      },
    ],
  },

  /* ── 2. The Broward notice ─────────────────────────────────────────── */
  {
    slug: 'broward-bsip-notice',
    service: 'broward-bsip',
    programs: ['broward-bsip'],
    seo: {
      title: 'La carta del BSIP en Broward: quién debe presentar',
      description:
        'Qué significa la carta del BSIP de Broward, qué edificios deben presentar el informe, cuáles quedan exentos y qué tiene que entregar el propietario.',
    },
    name: 'La carta del BSIP, explicada',
    h1: 'La notificación del BSIP en Broward: qué significa y quién debe presentar',
    heroSub:
      'Una carta certificada sobre el BSIP (Building Safety Inspection Program) significa que su edificio alcanzó en Broward la edad de inspección. Esto es lo que le pide.',
    card: 'Para un edificio de Broward que recibió la carta certificada: lo que le pide al propietario, y qué edificios quedan fuera del programa.',
    short: ["La carta certificada significa que su edificio está en la lista de Broward para este año y necesita inspección estructural y eléctrica.", "Entra casi cualquier edificio, y las pocas excepciones, como estructuras menores y viviendas pequeñas, se listan abajo.", "Se presenta un informe narrativo con fotos a color en los formularios oficiales del condado, nunca en los de una empresa."],
    sections: [
      {
        title: 'Qué es la carta',
        paras: [
          'El BSIP de Broward lo escribe, para todo el condado, su Junta de Reglas y Apelaciones (en inglés, Board of Rules and Appeals), y lo aplica el Building Official de cada municipio. Todos los años la Junta le entrega a cada municipio el listado de edificios que alcanzan la edad de inspección, y el municipio manda las notificaciones por correo certificado. La carta es esa notificación: indica que su edificio figura en el listado de este año y que hay que inspeccionarlo, en su parte estructural y en su parte eléctrica, con un informe que se presenta al municipio.',
          'Es común que los propietarios sigan dándole el nombre de recertificación de 40 años, que viene de una versión anterior del programa. Las edades y el tiempo para presentar cambiaron, y hay artículos viejos en internet que todavía describen las reglas de antes. Las filas de abajo dan las edades vigentes; el tiempo para presentar está en la guía sobre qué hacer cuando llega una notificación, y en la página del BSIP.',
        ],
        facts: [{ service: 'broward-bsip', keys: ['First due', 'Then'] }],
      },
      {
        title: 'Quién tiene que presentar',
        paras: [
          'Quien debe presentar es el dueño del edificio. En un condominio o en una cooperativa, eso quiere decir la asociación, que actúa a través de su junta; en un edificio de alquiler, comercial o de uso mixto, el propietario según el registro. Un administrador puede llevar el trámite, pero la presentación se hace por cuenta del propietario.',
          'Casi cualquier tipo de edificio entra en el programa, en todos los municipios de Broward y también fuera de ellos. Las excepciones son pocas, y la fila de abajo las enumera como las recoge la política de la Junta. Tampoco entran los edificios del gobierno federal o del Estado de Florida, las escuelas que dependen de la junta escolar del condado, los ferrocarriles ni los edificios situados en tierras tribales soberanas.',
        ],
        facts: [{ service: 'broward-bsip', keys: ['Applies to'] }],
      },
      {
        title: 'Qué hay que entregar',
        paras: [
          'Broward pide dos inspecciones, una estructural y otra eléctrica, redactadas como un informe narrativo que lleva los formularios propios de la Junta para cada una y fotografías a color. Los formularios que haya hecho por su cuenta una empresa de ingeniería no sustituyen a los de la Junta.',
          'La política vigente de la Junta no exige certificados del estacionamiento ni termografía como documentos separados; las barandas y los garajes de estacionamiento se revisan dentro de la estructura. Algunos municipios añaden una portada o un formulario de entrega propio, y en ese caso la carta lo dice.',
        ],
        list: [
          'Mándenos la carta, junto con la fecha en que la recibió el edificio.',
          'Leemos lo que exige su municipio y le enviamos una propuesta de precio fijo por todo el paquete del BSIP.',
          'El informe se entrega apenas está terminado, aunque enumere reparaciones; tras ellas, el expediente se cierra con un informe enmendado y una carta de terminación de obra.',
        ],
      },
    ],
    faqTitle: 'Preguntas sobre la carta del BSIP',
    faq: [
      {
        q: '¿Una comunidad de casas adosadas (townhouses) tiene que presentar?',
        a: 'Las casas adosadas con propiedad plena del terreno (fee simple) no entran en el programa, como indica la fila “Aplica a”. Si la propiedad es de otro tipo, la respuesta depende del edificio: mándenos la dirección y lo revisamos.',
      },
      {
        q: 'A nuestro edificio lo inspeccionaron con el programa anterior. ¿Eso vale?',
        a: 'Sí. Un edificio inspeccionado con la versión anterior se da por cumplido, y su próxima inspección sigue el intervalo de la fila “Después”. La carta del municipio señala el año.',
      },
      {
        q: '¿La carta del BSIP equivale a la inspección de hito del estado?',
        a: 'Para los edificios de condominio o de cooperativa con tres o más pisos habitables, el informe del BSIP cumple además la inspección de hito (milestone) del estado, en sus dos fases. Siguen vigentes las obligaciones que la ley estatal le impone a la junta frente a los dueños de cada unidad.',
      },
      {
        q: '¿Quién contesta las dudas sobre la carta en sí?',
        a: 'La oficina que la mandó. Para lo que implican la inspección y el informe, mándenos la carta y la leemos antes que nada.',
      },
    ],
  },

  /* ── 3. Is the building due? ───────────────────────────────────────── */
  {
    slug: 'is-my-building-due',
    service: 'building-recertification',
    programs: ['building-recertification', 'broward-bsip'],
    heroAction: 'address',
    seo: {
      title: '¿Ya le toca la recertificación a su edificio?',
      description:
        'Cómo saber si a un edificio de Miami-Dade o Broward le toca recertificar o pasar por el BSIP: el registro que fija su edad, el listado y la carta.',
    },
    name: '¿Le toca a mi edificio?',
    h1: 'Cómo comprobar si a su edificio ya le corresponde la inspección',
    heroSub:
      '¿Aún no tiene carta, o no está seguro de que le aplique? La edad que cuenta consta en un registro público que usted mismo puede comprobar, y cada condado la toma de un registro distinto.',
    card: '¿Aún sin carta? Dónde consta la edad que cuenta, condado por condado, para revisarla antes de que llegue la notificación.',
    short: ["Primero confirme el condado, no el municipio, porque cada condado toma la edad de un registro público distinto.", "Miami-Dade usa el año de construcción del Property Appraiser, y Broward, la fecha de expedición de su certificado de ocupación.", "Si el edificio ya está en edad de inspección o cerca, mándenos la dirección, y así cualquier reparación se planea con tiempo."],
    sections: [
      {
        title: 'Empiece por el condado donde está el edificio',
        paras: [
          'Miami-Dade y Broward cuentan la edad de un edificio con registros distintos, así que lo primero es saber el condado, no el municipio. Un edificio en Aventura depende del programa de Miami-Dade; uno al otro lado de la línea del condado, en Hallandale Beach, depende del de Broward.',
          'Después busque la edad desde la cual cuenta ese condado y compárela con sus filas, más abajo. Si el edificio ya superó esa edad, o le falta poco, la notificación está por llegar o ya va con retraso, haya llegado una carta o no; y aun con retraso, todavía tiene solución.',
        ],
      },
      {
        title: 'En Miami-Dade: el año de construcción que registra el Property Appraiser',
        paras: [
          'Miami-Dade cuenta a partir del año de construcción que el Property Appraiser, la oficina que tasa las propiedades del condado, indica para el inmueble. Puede buscar el edificio por su dirección en el buscador público de esa oficina y leer el año en la ficha. Una remodelación no lo modifica.',
          'Las reglas del condado le piden a la oficina de construcción que mande avisos de cortesía antes del aviso formal. Son útiles, pero que no lleguen no cambia nada: el edificio queda dentro del programa por el tipo de edificio que es y por los años que tiene. Los tipos están en la fila de abajo; las edades, en la fila “Primer vencimiento” de la guía sobre los tres nombres del programa.',
        ],
        facts: [{ service: 'building-recertification', keys: ['Applies to'] }],
      },
      {
        title: 'En Broward: el certificado de ocupación',
        paras: [
          'Broward cuenta desde la fecha del certificado de ocupación, que está en los archivos de construcción de su municipio, y no desde el año que muestra el Property Appraiser, que puede no coincidir.',
          'Todos los años la Junta de Reglas y Apelaciones manda a cada municipio el listado de edificios que alcanzan la edad de inspección, y el municipio envía las notificaciones por correo certificado durante el verano. La oficina de construcción de su municipio puede decirle si el edificio figura en ese listado; también podemos consultar el registro por usted antes de mandarle una propuesta.',
          'La edad que cuenta Broward, y el intervalo que sigue, aparecen con su fuente en la guía sobre la carta del BSIP.',
        ],
      },
      {
        title: 'Cuando no está claro',
        paras: [
          'Hay casos que piden más atención: una propiedad con varios edificios levantados en años distintos, una ampliación, un edificio que se recertificó con un calendario anterior, o uno comprado hace poco cuyo vendedor nunca habló de un expediente abierto.',
        ],
        list: [
          'Mándenos la dirección y, si lo tiene, el año de construcción o la fecha del certificado de ocupación.',
          'Cuéntenos si el edificio se inspeccionó alguna vez dentro del programa, y en qué fecha.',
          'Comprobamos qué programa le corresponde al edificio y en qué punto está antes de proponerle nada.',
        ],
      },
    ],
    faqTitle: 'Cuando la edad no lo dice todo',
    faq: [
      {
        q: 'Nunca nos llegó una carta. ¿Podemos empezar igual?',
        a: 'Sí, y es la forma más tranquila de hacerlo. Una inspección hecha antes de la notificación da tiempo para planear las reparaciones en vez de hacerlas con prisa.',
      },
      {
        q: '¿Una casa unifamiliar necesita recertificación?',
        a: 'No, en ninguno de los dos condados. Las filas de la página de cada programa enumeran los edificios residenciales pequeños que quedan fuera.',
      },
      {
        q: 'Vamos a comprar un edificio. ¿Cómo sabemos si tiene una recertificación pendiente?',
        a: 'Pídale al vendedor el informe más reciente y cualquier notificación, y consulte en la oficina de construcción del municipio si hay algún expediente abierto para esa dirección. Podemos revisar lo que reciba antes del cierre de la compra.',
      },
    ],
  },

  /* ── 4. 30 vs 40 vs 50-year ────────────────────────────────────────── */
  {
    slug: 'recertification-30-40-50-year',
    service: 'building-recertification',
    programs: ['building-recertification'],
    seo: {
      title: 'Recertificación de 40 años y sus otros nombres',
      description:
        'Se busca la recertificación de 30 años, de 40 años y de 50 años; en Miami-Dade son nombres de un mismo programa. Qué quiere decir hoy cada nombre.',
    },
    name: 'Nombres: 30, 40, 50 años',
    h1: '“30 años”, “40 años”, “50 años”: un programa de Miami-Dade con tres nombres',
    heroSub:
      'Los nombres cuentan los años que tiene el edificio al momento de una inspección. Hay un solo programa, la recertificación de edificios de Miami-Dade, y se repite durante toda la vida del edificio.',
    card: 'Para una junta de Miami-Dade que no sabe qué nombre le aplica: un programa, tres nombres que buscan los dueños, y qué significa hoy cada uno.',
    short: ["Los nombres que buscan los dueños indican los años del edificio al inspeccionarlo, y en Miami-Dade todos remiten a un solo programa.", "El nombre más conocido quedó desactualizado: hoy la primera inspección toca más pronto, a las edades que aparecen abajo.", "En Broward esos mismos nombres apuntan a un programa distinto, el BSIP, que tiene edades y plazos propios."],
    sections: [
      {
        title: 'De dónde vienen los nombres',
        paras: [
          'Durante décadas la primera recertificación de Miami-Dade vencía a la edad que lleva en su nombre, así que los propietarios bautizaron al programa como la “recertificación de 40 años”. El nombre se quedó, y todavía se lee en cartas, contratos y presupuestos de condominio.',
          'Con el tiempo el condado adelantó la primera inspección, y los propietarios empezaron a buscar también la “recertificación de 30 años”, otro nombre para lo mismo. Un edificio que ya pasó por su primera inspección llega a la siguiente más adelante en su vida, y por eso algunos le ponen a esa el nombre de “recertificación de 50 años”. Cada nombre es la edad del edificio en una inspección; detrás de los tres hay un único programa.',
        ],
      },
      {
        title: 'Lo que dicen hoy las reglas del condado',
        paras: [
          'Dos filas lo deciden: la edad en que vence la primera recertificación, y el intervalo que viene luego. Se reproducen aquí desde la fila verificada del programa del condado, con su fuente.',
        ],
        facts: [{ service: 'building-recertification', keys: ['First due', 'Then'] }],
      },
      {
        title: 'Qué cambia entre la primera inspección y las siguientes',
        paras: [
          'En los papeles, muy poco: cada ciclo pide el mismo paquete completo en los formularios del condado, o sea, los informes estructural y eléctrico y los certificados que le correspondan al edificio. Lo que cambia es lo que encuentra la inspección. En su primer ciclo, un edificio suele arrastrar mantenimiento pendiente; en los ciclos siguientes, los informes previos muestran qué se reparó y qué se dejó en observación.',
          'Por eso pesa tanto el último informe. Le enseña al ingeniero el estado en que estaba el edificio, acorta la inspección y le permite a la junta ver si una condición es nueva o si ya se venía vigilando.',
        ],
        list: [
          'Guarde cada informe de recertificación y cada informe enmendado que el edificio haya presentado.',
          'Archive junto a ellos los permisos de reparación y sus inspecciones finales.',
          'Mande el más reciente cuando pida una propuesta.',
        ],
      },
      {
        title: '¿Y en Broward?',
        paras: [
          'En Broward los propietarios usan esos mismos nombres para otro programa, el BSIP (Building Safety Inspection Program), que tiene sus propias edades y su propio plazo. Nunca evalúe un edificio de Broward con las filas de Miami-Dade, ni a la inversa.',
        ],
      },
    ],
    faqTitle: 'Lo que preguntan los dueños sobre los nombres',
    faq: [
      {
        q: '¿Todavía existe la llamada “recertificación de 40 años”?',
        a: 'Como nombre, sí: dueños y prestamistas lo siguen usando. Como regla, la edad que dispara la primera inspección es la que figura en la fila “Primer vencimiento” del condado.',
      },
      {
        q: 'Recertificamos el edificio con el calendario anterior. ¿Volvemos a empezar?',
        a: 'No. Un edificio que ya se recertificó con el calendario anterior conserva el ciclo que llevaba. Mándenos el último informe y le decimos cuándo vence el próximo.',
      },
      {
        q: '¿La regla de la costa abarca todos los edificios cercanos a la playa?',
        a: 'No. Solo abarca los edificios de condominio y de cooperativa que describe la fila “Primer vencimiento”; el resto de los edificios cercanos a la costa sigue la edad general.',
      },
    ],
  },

  /* ── 5. Milestone vs recertification vs SIRS ───────────────────────── */
  {
    slug: 'milestone-recertification-sirs',
    service: 'milestone-inspections',
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: 'Inspección de hito, recertificación y SIRS',
      description:
        'La inspección de hito de Florida, la recertificación o el BSIP y el estudio de reservas (SIRS): qué le toca a una junta de condominio y cómo encajan.',
    },
    name: 'Hito, recertificación y SIRS',
    h1: 'Inspección de hito, recertificación y SIRS: lo que le toca a una junta de condominio',
    heroSub:
      'Tres nombres, dos leyes, un edificio. En Miami-Dade y Broward, la inspección del condado y la de hito del estado son un solo informe; el estudio de reservas es otro asunto.',
    card: 'Para una junta de condominio de cualquier condado: tres nombres que escucha, cuáles dos son un mismo informe y cuál planifica el dinero.',
    short: ["Si un condominio o cooperativa tiene tres o más pisos habitables, su informe de Miami-Dade o Broward cuenta como inspección de hito.", "La junta aún debe avisar de la inspección a cada dueño y mandarle el resumen del ingeniero en los plazos de ley.", "El estudio de reservas, o SIRS, es otra obligación que planifica el dinero para reparar y reemplazar, no un informe de inspección."],
    sections: [
      {
        title: 'La inspección de hito que exige el estado',
        paras: [
          'Después del derrumbe de Surfside, Florida creó una inspección de hito (milestone) para los edificios de condominio o de cooperativa con tres o más pisos habitables. Se hace en dos fases: una primera fase visual, y una segunda solo si en la primera aparece un deterioro estructural sustancial. La fila del estado que sigue es la de la ley.',
        ],
        facts: [{ service: 'milestone-inspections', keys: ['Applies to', 'Phase two'] }],
      },
      {
        title: 'En Miami-Dade y Broward, el informe del condado ya la cumple',
        paras: [
          'Los dos condados ya contaban con programas para edificios de cierta edad, y la inspección estatal se cumple por medio de ellos. Una junta de cualquiera de los dos condados no contrata una inspección de hito aparte de su informe del condado; ese informe es la inspección de hito.',
        ],
        facts: [
          { service: 'building-recertification', keys: ['Condominiums & co-ops'] },
          { service: 'broward-bsip', keys: ['Condominiums & co-ops'] },
        ],
        list: [
          'Lo que suma la ley estatal son las obligaciones de la junta frente a los dueños de cada unidad: avisarles de la inspección y hacerles llegar el resumen del ingeniero cuando se recibe el informe.',
          'Esas obligaciones, con sus plazos en días, figuran en la página de cada programa de condado, en el apartado “Qué debe hacer la junta directiva”.',
          'Los edificios que no son condominios ni cooperativas solo dependen del programa de su condado.',
        ],
      },
      {
        title: 'El estudio de reservas para la integridad estructural (SIRS)',
        paras: [
          'El estudio de reservas es otra obligación, impuesta por las leyes de condominios y cooperativas de Florida, y no es un informe de inspección. Calcula cuánto costará reparar o reemplazar, a lo largo de su vida útil, el techo, la estructura y los otros componentes que señala la ley, y cuánto tendría que apartar cada año la asociación para cubrirlo.',
          'Los dos van de la mano: lo que encuentra una inspección es lo que un estudio de reservas tiene que presupuestar. Una junta que cuenta con un informe reciente de recertificación o del BSIP les da a quienes preparan su estudio de reservas una visión mucho más fiel del edificio.',
        ],
      },
      {
        title: '¿Cuál vence primero?',
        paras: [
          'Para la inspección, manda la fecha de la notificación de su condado. Para el estudio de reservas, la asociación se guía por las leyes estatales de condominios y cooperativas y por su propio abogado. Si la junta no sabe cómo está el edificio respecto de lo primero, por ahí empezamos: mándenos la dirección y cualquier carta, y le decimos qué inspección le corresponde al edificio y para cuándo.',
        ],
      },
    ],
    faqTitle: 'Lo que preguntan las juntas sobre los tres',
    faq: [
      {
        q: '¿Presentamos un informe de hito y otro de recertificación?',
        a: 'En Miami-Dade y Broward, no. El informe del condado hace las veces de inspección de hito; en Miami-Dade el condado aclara de forma expresa que no hay un informe de hito por separado.',
      },
      {
        q: 'Nuestro edificio de apartamentos es de alquiler, no un condominio. ¿La ley de hito nos alcanza?',
        a: 'No. La ley de hito alcanza a los edificios de condominio y de cooperativa; un edificio de alquiler sigue sujeto al programa de su condado, que abarca casi cualquier tipo de edificio.',
      },
      {
        q: '¿La recertificación sustituye al estudio de reservas?',
        a: 'No. Contestan preguntas diferentes: una dice en qué estado se encuentra el edificio, la otra planifica el dinero para que siga así.',
      },
    ],
  },

  /* ── 6. A failed recertification ───────────────────────────────────── */
  {
    slug: 'failed-recertification',
    service: 'building-recertification',
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: '¿Y si el edificio no aprueba la recertificación?',
      description:
        'Si un informe de recertificación o del BSIP enumera reparaciones, o no se entrega a tiempo: qué sigue en Miami-Dade y Broward, y cómo se cierra.',
    },
    name: 'Si el edificio no aprueba',
    h1: 'Qué pasa cuando un edificio “no aprueba” su recertificación',
    heroSub:
      'Casi todos los edificios que “no aprueban” tienen un informe que enumera reparaciones, y para eso hay un camino fijo hasta el cierre. El informe que nunca se entrega es el caso que sale caro.',
    card: 'Para un edificio cuyo informe enumera reparaciones, o cuyo informe nunca se entregó: dos casos muy distintos, y cómo se cierra cada uno.',
    short: ["Cuando se dice que un edificio no aprobó, casi siempre el informe enumera reparaciones, y aun así se entrega a tiempo.", "Cada condado fija un plazo para reparar, que figura abajo, y el expediente solo se cierra con las reparaciones hechas.", "Lo que hay que evitar es un informe nunca entregado: Miami-Dade lo envía a cumplimiento del código y Broward, a una audiencia."],
    sections: [
      {
        title: 'El formulario no aprueba ni reprueba',
        paras: [
          'Un informe de recertificación o del BSIP no le pone nota a un edificio. Deja constancia de lo observado y dice si el edificio es seguro para seguir en uso tal como está, o qué hay que reparar antes. Lo que los dueños llaman “no aprobar” suele ser lo segundo: el informe enumera reparaciones.',
          'Ese informe se entrega igual, y en plazo. Los dos condados quieren primero el informe y luego las reparaciones, con permiso. Un informe que se guarda hasta acabar las reparaciones es un informe fuera de plazo.',
        ],
      },
      {
        title: 'Cuando el informe enumera reparaciones',
        paras: [
          'Cada condado da un plazo para la obra que sigue al informe. Las filas de abajo son las reglas de cada condado según se verificaron; su Building Official puede fijarle otro plazo a su expediente.',
        ],
        facts: [
          { service: 'building-recertification', keys: ['If repairs are needed'] },
          { service: 'broward-bsip', keys: ['If repairs are needed'] },
        ],
        list: [
          'Un alcance de reparaciones por escrito, para que cada contratista cotice la misma obra.',
          'Permisos para las reparaciones que los requieran, tramitados por el contratista.',
          'Cuando se pida, una carta que diga si el edificio puede seguir habitado durante la obra.',
          'Una nueva inspección de las zonas reparadas y, luego, un informe enmendado (en Broward acompañado de una carta de terminación de obra) que da por cerrado el expediente.',
        ],
      },
      {
        title: 'Cuando el informe no se entrega',
        paras: [
          'Dejar pasar la fecha es lo que hay que evitar. Según el proceso que publica Miami-Dade, una recertificación atrasada pasa a la vía de cumplimiento, con sanciones que pueden ir creciendo y un gravamen (lien) que puede llegar después. La política de Broward lleva un expediente atrasado a una audiencia ante un Special Magistrate o ante el Code Enforcement Board, y un edificio que no hace las reparaciones exigidas puede ser declarado inseguro. Cada municipio define sus propios pasos y montos.',
          'Si la fecha ya pasó, se sale por donde se entra: hacer la inspección, entregar el informe y avisar a la oficina que mandó la notificación de que el trabajo ya está en curso. Mándenos primero la notificación y cualquier citación.',
        ],
      },
      {
        title: 'Cuando el ingeniero encuentra un peligro',
        paras: [
          'En raras ocasiones, una inspección halla una condición que pone en riesgo a personas o bienes. El ingeniero tiene entonces el deber de comunicarla enseguida, al propietario y al Building Official, sin esperar al informe. Lo que pase con los ocupantes lo decide esa oficina. Apuntalar, cerrar un balcón o un piso del garaje y hacer reparaciones de emergencia suelen ser los primeros pasos.',
        ],
      },
    ],
    faqTitle: 'Después de un informe con reparaciones',
    faq: [
      {
        q: '¿Tenemos que arreglar todo antes de presentar?',
        a: 'No. Primero se entrega el informe, con las reparaciones que enumera; después, las reparaciones se hacen con permiso dentro del plazo que dé su condado o su municipio.',
      },
      {
        q: '¿Quién cierra el expediente después de las reparaciones?',
        a: 'El informe enmendado lo emite el profesional que presentó el informe original. Si el suyo lo presentó otra empresa de ingeniería, cuéntenoslo al escribirnos y le decimos qué hará falta para cerrarlo.',
      },
      {
        q: '¿Las reparaciones tienen que poner el edificio al nivel del código de hoy?',
        a: 'No. Las reparaciones devuelven a su estado lo que el informe encontró deficiente; el edificio se juzga con el código que regía cuando se construyó.',
      },
      {
        q: '¿Se puede alargar el plazo para reparar?',
        a: 'El Building Official que tiene su expediente puede fijar otro plazo. Consulte a esa oficina antes de que se acabe el plazo, no después.',
      },
    ],
  },

  /* ── 7. Parking-lot certificates ───────────────────────────────────── */
  {
    slug: 'parking-lot-illumination-guardrail',
    service: 'building-recertification',
    programs: ['building-recertification'],
    seo: {
      title: 'Certificados de iluminación y barandas en Miami-Dade',
      description:
        'Las dos certificaciones de estacionamiento que pide Miami-Dade al recertificar: qué registran los formularios de iluminación y barandas, y cuándo aplican.',
    },
    name: 'Iluminación y barandas del estacionamiento',
    h1: 'Los certificados de estacionamiento en Miami-Dade: iluminación y barandas',
    heroSub:
      'Una recertificación en Miami-Dade es más que un informe estructural y otro eléctrico. Cuando corresponde, también lleva dos certificaciones del estacionamiento.',
    card: 'Para una propiedad de Miami-Dade con estacionamiento: los dos formularios que acompañan la recertificación, y qué registra cada uno.',
    short: ["Cuando corresponden, Miami-Dade, a diferencia de Broward, suma a la recertificación dos formularios del estacionamiento: uno de iluminación y otro de barandas.", "La luz se mide de noche contra la norma del condado; la baranda solo se exige si el estacionamiento da al agua.", "Poca luz suele indicar luminarias dañadas o árboles crecidos sobre los postes, y la baranda que falte se coloca con permiso."],
    sections: [
      {
        title: 'Dos formularios que van con los informes',
        paras: [
          'Además de los informes estructural y eléctrico, el Condado de Miami-Dade pide dos certificaciones sobre el estacionamiento que usa el edificio, cuando corresponden: una de iluminación (Parking Lot Illumination) y otra de barandas (guardrails). Se entregan con el resto del paquete de recertificación, en formularios del condado.',
          'Ninguna de las dos promete que el estacionamiento vaya a pasar. Cada formulario deja constancia de lo medido o lo encontrado, y con él la junta sabe si hay que corregir algo antes de que la recertificación pueda cerrarse.',
        ],
      },
      {
        title: 'La certificación de iluminación',
        paras: [
          'Los niveles de luz se miden en el lugar, de noche, en el estacionamiento que usa el edificio, y se comparan con lo que el condado exige para esa clase de edificio. El formulario anota los niveles medidos y si alcanzan o no esa exigencia.',
          'Si no la alcanzan, las soluciones habituales son eléctricas: luminarias, postes o fotoceldas que fallan, o lámparas que se cambiaron por otras más débiles. Una vez corregido, el estacionamiento se vuelve a medir para que conste.',
          'Los árboles que crecieron sobre los postes de luz desde que se hizo el estacionamiento son una causa frecuente, y la más barata de corregir: muchas veces basta con podarlos.',
        ],
      },
      {
        title: 'La certificación de barandas',
        paras: [
          'Este formulario responde primero algo sencillo: ¿el estacionamiento está junto a un canal, un lago u otra masa de agua? Si no lo está, el formulario así lo indica. Si lo está, anota si los vehículos que se estacionan allí quedan protegidos por la baranda que el condado pide a lo largo del agua.',
          'Si la baranda falta o está dañada, el dueño necesita un permiso para colocarla o repararla, y la certificación se completa cuando ya está puesta.',
          'La pregunta es sobre el estacionamiento, no sobre el edificio: una propiedad apartada de un canal puede tener, aun así, una fila de plazas que corre por la orilla. Es fácil pasarlo por alto, así que recorra el borde del estacionamiento antes del día de la inspección.',
        ],
      },
      {
        title: 'Broward es distinto',
        paras: [
          'La política vigente de la Junta de Reglas y Apelaciones de Broward no pide ningún certificado de estacionamiento por separado. En Broward, las barandas y los garajes de estacionamiento son partes de la inspección estructural, y el cableado de los estacionamientos entra en la eléctrica. Un edificio de Broward no presenta los formularios de estacionamiento de Miami-Dade.',
        ],
      },
    ],
    faqTitle: 'Preguntas sobre los dos formularios de estacionamiento',
    faq: [
      {
        q: '¿Todos los edificios de Miami-Dade presentan los dos certificados?',
        a: 'No. Se presentan cuando corresponden al edificio y a su estacionamiento; leemos su notificación y le decimos cuáles necesita su paquete.',
      },
      {
        q: '¿Un garaje de estacionamiento cuenta como estacionamiento?',
        a: 'Un garaje es una estructura, y se revisa para el informe estructural. Las certificaciones se refieren al estacionamiento que usa el edificio; le decimos qué le corresponde al suyo.',
      },
      {
        q: '¿Estos certificados encarecen mucho el trabajo?',
        a: 'Forman parte del paquete completo y van en la misma propuesta de precio fijo. Las reparaciones que generen, como luminarias nuevas o una baranda, se cotizan aparte.',
      },
    ],
  },
  /* ── Since 2026-10-26: one guide for each service the guides did not reach ── */
  {
    slug: "threshold-building",
    service: "threshold-inspections",
    programs: ["building-recertification", "broward-bsip"],
    seo: {
      title: "¿Su edificio es threshold? La prueba de Florida",
      description: "Cómo define Florida un edificio threshold: pisos, altura o una gran sala de reunión, y qué cambia luego en la inspección de Miami-Dade y de Broward.",
    },
    name: "¿Es un edificio threshold?",
    h1: "¿Su edificio es un edificio threshold? Cómo saberlo y qué cambia",
    heroSub: "La ley threshold de Florida traza su línea por los pisos, la altura o una sala de reunión grande. Pasada esa línea, la misma inspección del condado les pide más a quienes la preparan, tanto en Miami-Dade como en Broward.",
    card: "Para juntas y dueños de edificios altos: las tres pruebas de la ley threshold y lo que pide luego cada condado.",
    short: ["Florida llama threshold al edificio de más de tres pisos o cincuenta pies, o con gran sala de reunión a cualquier altura.", "El programa del condado y sus plazos no cambian, pero la regla sobre quién prepara el informe estructural se vuelve más estricta.", "La inspección especial durante la construcción es otro requisito, ligado a la obra y no al programa del condado."],
    sections: [
      {
        title: "Dónde traza Florida la línea threshold",
        paras: [
          "La ley threshold de Florida da tres maneras de pasar la línea, y basta con cumplir una. Dos son de tamaño: más de tres pisos, o una altura de más de cincuenta pies, para cualquier uso, desde una torre de condominios hasta un garaje. La tercera es de gente: un espacio que el Código de Construcción de Florida clasifica como de reunión, de más de cinco mil pies cuadrados y con una capacidad de ocupación de más de quinientas personas, lo vuelve threshold a cualquier altura.",
          "Los dos condados usan la línea del estado. El programa de Broward y el código de Miami-Dade repiten la definición, y la página de Miami-Dade expresa la prueba de pisos como cuatro pisos o más. En ningún condado es un programa aparte: cambia lo que debe llevar el expediente.",
        ],
      },
      {
        title: "Qué cambia en la inspección del condado",
        paras: [
          "Ser threshold no mueve la edad a la que el edificio debe inspeccionarse, ni la notificación que recibe, ni el plazo que tiene para presentar el informe. Cambia quién puede prepararlo, y cada condado escribe esa regla a su manera.",
          "La carta de autocalificación es un requisito de Miami-Dade; los textos del programa de Broward no la piden. El formulario estructural de Broward pregunta, en cambio, si el edificio es threshold y si el profesional que prepara la porción estructural es Inspector Especial certificado.",
        ],
        list: [
          "Miami-Dade, estructural: un ingeniero especializado en diseño estructural, cuyo informe lleva una carta de autocalificación con prueba de la especialización estructural reconocida por el estado.",
          "Miami-Dade, eléctrica: un ingeniero especializado en diseño eléctrico.",
          "Broward, estructural: un profesional con licencia de Florida, especializado en ingeniería estructural y con licencia de Inspector Especial.",
          "Broward, eléctrica: un profesional con licencia de Florida especializado en diseño eléctrico, la misma regla que para todo edificio del programa.",
        ],
      },
      {
        title: "Una fachada sujeta con sellador estructural",
        paras: [
          "En una fachada de acristalamiento estructural, el vidrio va adherido al marco con un sellador estructural, en lugar de quedar sujeto con metal en todos sus bordes. Si el edificio es threshold y está en Miami-Dade, esa fachada debe recertificarse por su cuenta cada cinco años, aparte del informe del edificio.",
          "Miami-Dade aplica ese ciclo con guías publicadas: el condado envía un aviso para la fachada, el informe vence a los noventa días y el inspector debe tener la certificación del estado como Inspector Especial para edificios threshold. En Broward, el formulario estructural del programa pregunta si un edificio threshold tiene acristalamiento estructural, cuándo se inspeccionó el sistema por última vez y en qué estado está.",
          "No todo muro de vidrio es acristalamiento estructural; los planos de la fachada muestran cómo se sujeta el vidrio.",
        ],
      },
      {
        title: "Cómo saberlo antes de la notificación",
        paras: [
          "Casi toda la respuesta está en los planos. La ley threshold cuenta pisos, mientras que la ley estatal de inspecciones de hito cuenta solo los habitables, así que un piso de estacionamiento o de locales no sale de la cuenta threshold solo porque nadie viva en él.",
          "Si alguna prueba queda justa, por un nivel en parte bajo tierra o un entrepiso, mándenos la dirección y el uso de cada planta, y lo revisamos con la regla de su condado.",
        ],
        list: [
          "Pisos: más de tres, contando cada planta que el código cuenta como piso.",
          "Altura: más de cincuenta pies, lo que vuelve threshold también a un edificio de tres pisos o menos.",
          "Reunión: un espacio clasificado como de reunión, de más de cinco mil pies cuadrados y para más de quinientas personas.",
          "La redacción de Miami-Dade: cuatro pisos o más, la misma línea que la del estado.",
          "La fachada: en Miami-Dade, el vidrio sujeto con sellador estructural tiene un ciclo propio.",
        ],
      },
    ],
    faqTitle: "Preguntas de las juntas de edificios altos",
    faq: [
      { q: "Nuestro edificio tiene tres pisos de viviendas sobre un nivel de estacionamiento. ¿Es threshold?", a: "Lo es, si el nivel de estacionamiento cuenta como piso. La ley threshold pide pisos, no pisos habitables, así que con ese nivel el edificio suma cuatro y pasa la línea en los dos condados. Un nivel en parte bajo tierra es el caso que conviene confirmar en los planos." },
      { q: "¿Un hotel o una iglesia es un edificio threshold?", a: "Con las mismas pruebas que cualquier otro edificio. Un hotel de más de tres pisos o cincuenta pies lo es. Una iglesia, o un hotel bajo con un salón de baile, lo es a cualquier altura cuando esa sala está clasificada como de reunión y pasa de cinco mil pies cuadrados y quinientas personas." },
      { q: "¿Threshold quiere decir inspección especial durante la construcción?", a: "Solo mientras el edificio se construye o se modifica su estructura. En una obra nueva, o en una reparación que modifica la estructura o las cargas que soporta, el estado exige un inspector especial certificado para la obra estructural. Es un requisito aparte del programa del condado y no lo ofrecemos; esta guía trata de un edificio ya construido." },
      { q: "Nos devolvieron el informe por la calificación de quien lo preparó. ¿Y ahora qué?", a: "Lea el comentario de la oficina junto con la regla de su condado, en la lista de arriba, porque Miami-Dade y Broward no piden lo mismo. Luego mándenos el comentario y el informe, y le decimos qué necesita el expediente antes de volver a presentarse." },
    ],
  },
  {
    slug: "balcony-spalling-cracks",
    service: "structural-condition-assessments",
    programs: [],
    seo: {
      title: "Balcón con concreto desprendido: cuándo llamar al ingeniero",
      description: "Concreto que se cae de un balcón, manchas de óxido, una baranda floja: qué suelen indicar, qué no puede esperar y qué aporta una evaluación estructural.",
    },
    name: "Grietas y desprendimientos en balcones",
    h1: "Desprendimientos, óxido y grietas en balcones: qué significan y cuándo llamar a un ingeniero",
    heroSub: "Que el concreto se desprenda del borde de un balcón es una señal que hay que entender, sin ignorarla y sin alarmarse. Aquí verá qué suele indicar donde hay aire salino, qué cerrar hoy mismo y qué puede planificar la junta.",
    card: "Para juntas, administradores o dueños ante un balcón que suelta concreto: qué indican las señales, qué no puede esperar y qué sigue.",
    short: ["Un balcón que suelta concreto suele tener el acero interior oxidándose e hinchándose, algo que no se detiene solo.", "Concreto suelto sobre un pasillo, baranda que se mueve o losa que cede: despeje el área y llame hoy al ingeniero.", "La evaluación separa lo estético de lo estructural, y con el diseño de reparación cada contratista cotiza exactamente la misma obra."],
    sections: [
      {
        title: "Lo que significan las señales del balcón",
        paras: [
          "Muchos balcones del Sur de Florida son losas de concreto que sobresalen de la pared, con su acero principal cerca de la cara superior. Cuando el concreto se desprende, lo más común es que la sal y la humedad hayan llegado a ese acero: el óxido ocupa más espacio que el acero sano, así que se hincha y empuja el concreto hacia afuera.",
          "No toda marca apunta al acero. Las grietas muy delgadas en la pintura, la cerámica o el estuco suelen quedarse en el acabado; una grieta que sigue la línea de una barra, o que suelta óxido, por lo general compromete el acero.",
        ],
        list: [
          "Concreto que falta en el borde o por debajo: por lo general, acero que se oxida detrás.",
          "Manchas marrones o anaranjadas: óxido que el agua arrastra hacia afuera, a menudo antes de que algo caiga.",
          "Una grieta en el borde o junto al poste de una baranda: a menudo, corrosión que empieza donde no se ve.",
          "Una baranda floja u oxidada en la base: puede que el poste, o el concreto que lo rodea, se esté deteriorando.",
          "Manchas de agua bajo la losa: agua que se mete en el concreto, camino del acero.",
        ],
      },
      {
        title: "Cuándo llamar ya y qué se puede planificar",
        paras: [
          "Tres señales tocan la seguridad hoy mismo: concreto suelto sobre un pasillo, una entrada, la terraza de la piscina o autos estacionados; una baranda que se tambalea o se ladea; una losa que se hunde o se inclina hacia afuera. Saque a todos de ese balcón y de la zona de abajo, y llame a un ingeniero ese mismo día.",
          "Las demás señales suelen dar tiempo para planificar, no para olvidarlas: la corrosión sigue avanzando, y una reparación pequeña que no se atiende tiende a crecer. Las pautas de Fannie Mae para condominios incluso cuentan los balcones entre las reparaciones críticas por las que un proyecto deja de calificar para los préstamos que esa entidad compra. Las condiciones de abajo suelen poder esperar al calendario de la junta, una vez que un ingeniero las haya visto.",
        ],
        list: [
          "Manchas de óxido donde todavía no hay concreto suelto.",
          "Desprendimientos pequeños lejos de donde la gente camina, se sienta o estaciona.",
          "Grietas muy delgadas en un acabado, sin óxido ni movimiento.",
          "Manchas de agua ya secas bajo la losa.",
        ],
      },
      {
        title: "Lo que aportan una evaluación y un diseño de reparación",
        paras: [
          "La evaluación empieza por los documentos del edificio y sigue con los balcones mismos. El concreto se sondea, por lo general con un martillo, porque el que se ha separado de su acero suena hueco antes de caer; las barandas se revisan a mano en su base.",
          "Cada condición se clasifica por lo que significa para la estructura, no por su aspecto. El diseño de reparación define luego dónde se retira concreto, qué se hace con el acero y cómo se rehacen los bordes, los anclajes de las barandas y la impermeabilización. En un balcón sostenido solo por la pared, hasta retirar concreto puede debilitarlo, así que los planos fijan el orden de los trabajos y cualquier apuntalamiento.",
        ],
        list: [
          "Un mapa de cada balcón revisado, con cada condición fotografiada en su lugar.",
          "Cada condición ordenada por su importancia estructural, y lo que va primero.",
          "Planos y especificaciones, para que cada oferta responda a la misma obra.",
          "Los documentos que el departamento de construcción revisa para dar el permiso de la reparación.",
        ],
      },
      {
        title: "Cómo encaja con los programas del condado y la ley de hitos",
        paras: [
          "Cuando llega el turno del edificio, la recertificación de Miami-Dade revisa sus balcones junto con el resto de la estructura, y el BSIP de Broward incluye los balcones unidos a un edificio. Un informe que enumera reparaciones de balcones se presenta en su fecha de todos modos; las reparaciones vienen después, con permiso, en el plazo que den el condado o el municipio.",
          "En todo el estado, la ley de hitos se aplica a los edificios residenciales en régimen de condominio o cooperativa de al menos tres pisos habitables cuando llegan a la edad que ella fija: una primera fase visual y luego otra, solo si la primera revela un deterioro estructural sustancial. Tanto Miami-Dade como Broward cuentan el informe del condado como cumplimiento de esa ley. Una evaluación intermedia no reemplaza a ninguno de los dos, pero permite a la junta llegar a su siguiente informe con las reparaciones de los balcones ya diseñadas, o hechas.",
        ],
      },
    ],
    faqTitle: "Preguntas de las juntas sobre sus balcones",
    faq: [
      { q: "¿Basta con que un contratista parche el concreto roto?", a: "Por lo general, no por mucho tiempo. Un parche cierra la superficie, pero sobre acero que sigue oxidándose suele volver a agrietarse, y entretanto oculta el problema; la reparación duradera retira el concreto dañado, trata o reemplaza el acero y rehace la sección, con planos y con el permiso que haga falta." },
      { q: "¿Hay que revisar todos los balcones?", a: "No siempre al principio. Si los balcones son parecidos, un grupo representativo, con los que muestran señales y los que quedan sobre pasillos, revela el patrón; si el deterioro resulta extendido, se sondea el resto antes de diseñar las reparaciones." },
      { q: "¿Una evaluación hará que el condado inspeccione el edificio?", a: "No por sí sola. Los programas del condado y la ley de hitos alcanzan a un edificio por su edad y su tipo, no por un estudio que encargue la junta. La evaluación cambia lo que la junta sabe: lo que ponga en peligro a las personas se atiende de inmediato, y las reparaciones llegan al departamento de construcción con su permiso." },
      { q: "¿Cuánto tarda la evaluación?", a: "Depende de cuántos balcones haya y de qué tan pronto puedan abrirse las unidades, porque a la mayoría de los balcones se llega por una. Lo urgente se le comunica a la junta durante la visita; el informe llega cuando los hallazgos quedan mapeados." },
    ],
  },
  {
    slug: "buying-a-building",
    service: "structural-condition-assessments",
    programs: [],
    seo: {
      title: "Comprar un edificio en Florida: la revisión estructural",
      description: "Comprar un edificio en Florida: qué informes pedirle al vendedor, qué dejan fuera y la evaluación estructural que conviene hacer antes del cierre.",
    },
    name: "Antes de comprar un edificio",
    h1: "Comprar un edificio: la revisión estructural antes del cierre",
    heroSub: "Una unidad de condominio, un edificio de apartamentos, una oficina, un local o un almacén en Florida: antes de cerrar la compra, sepa qué necesita la estructura y qué no dicen los papeles.",
    card: "Para quien compra, invierte o presta en Florida: qué papeles pedirle al vendedor y la revisión estructural antes del cierre.",
    short: ["Pídale al vendedor el informe de recertificación o BSIP, los permisos abiertos y, en condominios, la inspección de hito y el SIRS.", "Esos papeles muestran lo que se vio y se presentó, no el estado de la estructura el día de la compra.", "Una evaluación estructural en el período de inspección del contrato clasifica lo que encuentra y esboza las reparaciones, por prioridad, para negociar."],
    sections: [
      {
        title: "Qué pedirle al vendedor",
        paras: [
          "Empiece por los papeles que ya tienen el vendedor y la oficina de construcción. En Miami-Dade, un edificio que superó la edad de inspección del condado debería tener un expediente de recertificación; en Broward, uno del BSIP, el programa de inspecciones de seguridad que rige en todo el condado. Lo guarda la oficina de construcción local, y el vendedor debería poder entregarle una copia.",
          "Esa misma oficina puede decirle además si sigue abierto un expediente de recertificación o algún permiso de la propiedad.",
        ],
        list: [
          "El último informe de recertificación o del BSIP, y la notificación que lo pidió.",
          "La prueba de que el expediente se cerró: si el informe enumeró reparaciones, el informe enmendado y, en Broward, la carta de terminación de obra.",
          "Permisos abiertos o vencidos, y reparaciones en curso o apenas planeadas.",
          "Si el edificio es de condominio o cooperativa y tiene al menos tres pisos habitables: la inspección de hito, que en Miami-Dade y Broward es el informe del condado, y el último estudio de reservas de integridad estructural, el SIRS.",
        ],
      },
      {
        title: "Lo que dicen los documentos, y lo que no",
        paras: [
          "Cada informe de recertificación o del BSIP recoge una sola inspección: lo que se vio ese día, donde se pudo llegar, y si el edificio podía seguir en uso o necesitaba reparaciones antes. Lo ocurrido después, sea una filtración, una tormenta o una reparación aplazada, no figura en él, y lo oculto tras los acabados solo aparece donde se abrió algo.",
          "El estudio de reservas no es una inspección, sino el plan de la asociación para el dinero: lo que necesitarán el techo, la estructura, la impermeabilización, las ventanas y los demás elementos que enumera la ley durante su vida útil restante, y lo que conviene apartar cada año para ello. Leído junto a la inspección, le permite al comprador ver si lo que encontró la inspección está presupuestado.",
          "Un prestamista también puede leer estos papeles. Según las reglas de venta de Fannie Mae, un proyecto de condominio que necesita reparaciones críticas no es elegible para los préstamos que Fannie Mae compra, y entre los elementos que nombra están los balcones, los cimientos, las estructuras de estacionamiento, los muros de contención frente al agua y otras estructuras portantes. El prestamista debe revisar toda inspección estructural hecha en los últimos tres años y, si hubo reparaciones, el informe de un ingeniero sobre si resolvieron lo encontrado.",
        ],
      },
      {
        title: "La evaluación antes del cierre",
        paras: [
          "Una evaluación estructural previa a la compra responde lo que los papeles no pueden: el estado actual de la estructura. Parte de los planos originales, los permisos y los últimos informes, y compara el edificio tal como se diseñó con el que hoy está en pie; si faltan los planos, se comprueba más en el sitio.",
          "Prográmela al comienzo del período de inspección o de diligencia debida que permite su contrato, cuando aún hay tiempo de actuar según los resultados. En un condominio, el techo, el garaje y las demás áreas comunes se abren a través de la asociación o de su administrador.",
        ],
        list: [
          "La estructura recorrida y fotografiada: techo, vigas y columnas, losas, balcones, garaje y los cimientos visibles.",
          "Cada condición clasificada: estética o estructural, urgente o para vigilar.",
          "Las modificaciones evaluadas: una abertura en una losa o un muro, un piso añadido, un cambio de uso o una carga mayor.",
          "Las reparaciones que señala, por orden de prioridad, como base para hablar con el vendedor.",
          "Lo que quede en duda, marcado como pendiente, con la prueba o la apertura exploratoria que lo aclararía.",
        ],
      },
      {
        title: "Cuando al edificio le toca pronto",
        paras: [
          "Un edificio cerca de su próxima recertificación o inspección del BSIP trae esa inspección consigo, junto con las reparaciones que luego enumere el informe. Tras el cierre, responder por ellas le toca al nuevo dueño, o a la asociación si es un condominio.",
          "La edad que cuenta cada condado consta en registros públicos: en Miami-Dade, es el año de construcción tal como lo anota el Property Appraiser; en Broward, el día en que se expidió su certificado de ocupación. Mándenos la dirección durante el período de inspección y le indicamos qué inspección le corresponde después al edificio, y para cuándo.",
        ],
      },
    ],
    faqTitle: "Lo que preguntan los compradores antes del cierre",
    faq: [
      { q: "¿Basta con una inspección de vivienda para un edificio?", a: "Una inspección de vivienda es una revisión visual de una sola vivienda; en un condominio, esa vivienda es la unidad. Las vigas y columnas, las losas, los balcones y el garaje del edificio entero son una cuestión estructural, que pide la evaluación de un ingeniero." },
      { q: "El informe del vendedor es reciente. ¿Igual necesitamos una evaluación?", a: "Tal vez no una completa. Un informe reciente con sus reparaciones cerradas es un buen punto de partida; lo leemos primero y le decimos si algo en él, o algo posterior, pide una visita." },
      { q: "Al edificio le toca la recertificación el año que viene. ¿Quién la paga?", a: "La inspección va con el edificio: tras el cierre le toca responder al comprador, o a la asociación si es un condominio; que el vendedor asuma una parte o no lo acuerdan comprador y vendedor en el contrato de compra. Antes de esa conversación, podemos decirle qué vence y cuándo, qué implica la inspección y si el último informe dejó reparaciones pendientes." },
      { q: "¿Pueden revisar un almacén o una oficina?", a: "Sí, en cualquier parte de Florida. La evaluación no depende de ningún programa: abarca almacenes, oficinas, locales y edificios de apartamentos igual que una torre de condominio. En Miami-Dade y Broward, además, la mayoría entra en el programa del condado: pídale también ese informe al vendedor." },
    ],
  },
  {
    slug: "structural-peer-review-florida",
    service: "peer-review",
    programs: [],
    seo: {
      title: "Revisión estructural por pares en Florida: cuándo se exige",
      description: "La ley de permisos de Florida no pide revisión por pares, pero Coral Gables, la Ciudad de Miami y el Condado de Miami-Dade sí, para ciertos edificios.",
    },
    name: "Cuándo un diseño necesita revisión",
    h1: "Cuándo hace falta una revisión estructural por pares en Florida",
    heroSub: "La ley estatal de permisos no la pide, pero algunos funcionarios de construcción locales la ponen como condición del permiso. Aquí verá dónde se exige, qué abarca y cuándo conviene empezar.",
    card: "Para un desarrollador, dueño o prestamista con un diseño estructural: dónde la revisión por pares es condición del permiso y qué entrega.",
    short: ["La ley de permisos de Florida no pide una revisión por pares, pero algunos departamentos de construcción locales la exigen.", "Coral Gables, la Ciudad de Miami y el Condado de Miami-Dade publican cada uno su propia lista de edificios que la necesitan.", "Un ingeniero independiente lee el diseño, idealmente antes de presentarlo para el permiso, y el ingeniero de registro sigue respondiendo por él."],
    sections: [
      {
        title: "Por qué hace falta la lectura de otro ingeniero",
        paras: [
          "Un diseño estructural lo revisa el equipo que lo hizo, y también el departamento de construcción antes del permiso. La revisión por pares suma un lector ajeno al equipo de diseño, sin interés en sus decisiones, que sigue el camino de las cargas hasta el suelo.",
          "Lo que cuenta es el momento: un error hallado en los planos se resuelve con una respuesta y una hoja corregida, mientras que el mismo error hallado en obra puede significar apuntalar, reparar en sitio y perder semanas. Un funcionario de construcción puede ponerla como condición del permiso; un dueño, un prestamista o el propio equipo de diseño también pueden pedirla.",
        ],
      },
      {
        title: "Dónde la exige el funcionario de construcción",
        paras: [
          "La ley de Florida sobre permisos de construcción no menciona la revisión por pares. Los requisitos que siguen vienen de departamentos de construcción locales: cada uno la pone como condición de los permisos que emite, con criterios propios, de modo que el mismo diseño puede necesitarla en una ciudad y no en la de al lado.",
          "En Broward no se encontró ningún requisito para todo el condado al redactar esta guía, así que la respuesta la tiene la oficina que va a emitir el permiso: pregúntele directamente. Lo mismo vale para cualquier lugar que esta guía no nombra, y en todo el estado un dueño, un prestamista o una aseguradora pueden pedir la revisión de todos modos.",
        ],
        list: [
          "El Condado de Miami-Dade, sobre los edificios a los que da permiso en su área no incorporada: diez pisos o cien pies, lo que llegue primero; instalaciones esenciales que no sean de baja altura; medio millón de pies cuadrados o más en un solo piso; y más de tres pisos cuando el sistema que resiste el viento es de acero liviano (light-gauge) o de madera.",
          "La Ciudad de Miami: edificios residenciales y comerciales de altura superior a tres pisos o a cincuenta pies; instalaciones esenciales; más de un cuarto de millón de pies cuadrados de área de piso en total; y edificios cuyos pisos y muros estén armados con acero liviano.",
          "Coral Gables: los edificios threshold, tal como los define la ley estatal; instalaciones esenciales; edificios esbeltos, con una relación de aspecto (aspect ratio) de siete o más; edificios de más de un millón de pies cuadrados; cualquier elemento que sostenga, en total, más del quince por ciento del área del edificio; y diseños basados en análisis no lineal o de carga progresiva.",
          "En los tres casos, el funcionario de construcción también puede exigirla para un proyecto que no esté en estas listas, como una estructura inusual o compleja.",
        ],
      },
      {
        title: "Qué comprueba el revisor y qué le entrega",
        paras: [
          "El revisor lee los planos y los cálculos según el código que rige el proyecto, y hace cálculos independientes sobre una parte representativa de la estructura. Coral Gables incluye ese método en sus reglas, y le da al revisor los cálculos del diseñador solo como referencia.",
          "Lo que usted recibe es un informe de la revisión con una lista de comentarios, ordenados por su peso: cada uno indica la hoja, la inquietud y su consecuencia para la estructura. El equipo de diseño responde, el revisor lee cada respuesta, y un comentario se cierra solo cuando queda resuelto.",
          "La revisión no rediseña el edificio. El ingeniero de registro conserva la responsabilidad exclusiva del diseño; el revisor aporta una opinión independiente sobre él.",
        ],
        list: [
          "Las cargas y la trayectoria de carga, desde el techo hasta las cimentaciones.",
          "El modelo de análisis y las hipótesis que lo sostienen.",
          "Los detalles y las conexiones, y si se pueden construir tal como están dibujados.",
        ],
      },
      {
        title: "Cuándo empezar y qué enviar",
        paras: [
          "Empiece cuando el sistema estructural ya esté definido y antes de que los planos se presenten para el permiso. Para el Condado de Miami-Dade, los comentarios deben quedar resueltos antes de presentar la solicitud, así que una revisión que empieza tarde retrasa la presentación misma.",
          "Para empezar, nos bastan los planos y los cálculos. Revisamos si la oficina que va a emitir el permiso exige una revisión, y con cuál de sus criterios, y le enviamos una propuesta a la medida de la revisión que el proyecto necesita.",
        ],
        list: [
          "Los planos estructurales, en su última emisión.",
          "Los cálculos, y el modelo de análisis si lo hay.",
          "El estudio geotécnico, para las cimentaciones.",
          "La dirección, y la fecha en que piensa presentar los planos para el permiso.",
        ],
      },
    ],
    faqTitle: "Lo que preguntan dueños y equipos de diseño",
    faq: [
      { q: "¿Toda obra nueva en Florida necesita una revisión por pares?", a: "No. La ley estatal de permisos no la pide, y las reglas locales de esta guía alcanzan solo a los edificios que describen, o al proyecto que el funcionario de construcción señale. Cualquier dueño, prestamista o aseguradora puede pedir una revisión de todos modos." },
      { q: "Nuestro proyecto está en Broward. ¿La oficina de permisos la va a pedir?", a: "Al preparar esta guía no apareció ningún requisito para todo ese condado, así que conviene consultarlo con la oficina que va a emitir su permiso. Responda lo que responda, el dueño o el prestamista pueden pedir una revisión igual." },
      { q: "¿Quién elige al revisor?", a: "En el Condado de Miami-Dade, el dueño contrata a un ingeniero profesional independiente con licencia en Florida. La Ciudad de Miami pide que el dueño proponga hasta tres ingenieros estructurales de Florida, y la elección final se hace de común acuerdo con el funcionario de construcción." },
      { q: "¿Es la revisión por pares la inspección especial que se exige a un edificio threshold?", a: "No. La ley estatal sobre edificios threshold pide un inspector especial que inspecciona la estructura mientras se construye, o mientras una reparación o restauración modifica su sistema estructural o sus cargas; la revisión por pares lee el diseño mismo, sobre el papel." },
    ],
  },
];
