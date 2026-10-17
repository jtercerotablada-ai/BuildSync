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
  moreLabel: 'Siga leyendo',
  costLink: 'Lo que cuesta el trabajo',
  allGuides: 'Todas las guías',
  forProgram: 'Guías para dueños',
};

export const index: GuidesIndex = {
  seo: {
    title: 'Guías de recertificación y BSIP para propietarios',
    description:
      'Respuestas claras para dueños y juntas en Miami-Dade y Broward: la carta, qué programa aplica, hito o recertificación, reparaciones y estacionamientos.',
  },
  crumb: 'Guías',
  eyebrow: 'Guías',
  titleLines: ['Recertificación y BSIP,', 'explicados para dueños.'],
  accentWord: 'explicados para dueños.',
  sub: 'Los dos programas, explicados en guías breves para juntas directivas, dueños y administradores en Miami-Dade y Broward. Cada una responde una pregunta que surge cuando un edificio alcanza la edad de inspección, y cada una remite a las reglas verificadas de su condado.',
  listLabel: 'Las guías',
  listTitle: 'Elija la pregunta que tiene hoy.',
};

export const guides: Guide[] = [
  /* ── 1. The notice ─────────────────────────────────────────────────── */
  {
    slug: 'recertification-notice',
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
    card: 'Llegó la carta. Los cinco primeros pasos, y el plazo que empieza a correr.',
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
          'Cada condado maneja su propio plazo, y nunca hay que leer uno con las reglas del otro. Abajo está el tiempo que las reglas de cada condado dan para presentar el informe, tal como se verificó en las páginas de los programas; el tiempo para las reparaciones posteriores está en la guía sobre recertificaciones no aprobadas. La fecha impresa en su propia carta es la que cuenta.',
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
    card: 'Lo que la carta certificada le pide al propietario, y qué edificios quedan fuera del programa.',
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
    programs: ['building-recertification', 'broward-bsip'],
    seo: {
      title: '¿Ya le toca la recertificación a su edificio?',
      description:
        'Cómo saber si a un edificio de Miami-Dade o Broward le toca recertificar o pasar por el BSIP: el registro que fija su edad, el listado y la carta.',
    },
    name: '¿Le toca a mi edificio?',
    h1: 'Cómo comprobar si a su edificio ya le corresponde la inspección',
    heroSub:
      '¿Aún no tiene carta, o no está seguro de que le aplique? La edad que cuenta consta en un registro público que usted mismo puede comprobar, y cada condado la toma de un registro distinto.',
    card: '¿Aún sin carta? Dónde consta la edad que cuenta, condado por condado.',
    sections: [
      {
        title: 'Empiece por el condado donde está el edificio',
        paras: [
          'Miami-Dade y Broward cuentan la edad de un edificio con registros distintos, así que lo primero es saber el condado, no el municipio. Un edificio en Aventura depende del programa de Miami-Dade; uno al otro lado de la línea del condado, en Hallandale Beach, depende del de Broward.',
          'Después busque la edad desde la cual cuenta ese condado y compárela con sus filas, más abajo. Si el edificio ya superó esa edad, o le falta poco, la notificación está por llegar o ya va con retraso, haya llegado una carta o no.',
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
    card: 'Un programa, tres nombres que buscan los dueños, y lo que quiere decir hoy cada uno.',
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
    card: 'Tres nombres que escucha una junta de condominio, y cuáles de ellos son un mismo informe.',
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
    card: 'Un informe que enumera reparaciones, y un informe que nunca se entregó: dos casos muy distintos.',
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
    card: 'Los dos formularios de estacionamiento de una recertificación en Miami-Dade, y qué registra cada uno.',
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
];
