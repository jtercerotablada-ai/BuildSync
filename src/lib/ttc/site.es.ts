/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TERCERO TABLADA — public site content (SPANISH)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mirror of `site.ts` in Spanish. Same object shape, same routes, slugs,
 * photos and counts — only the words differ. The English file is the source
 * of truth for STRUCTURE; edit both when adding or removing an item.
 *
 * Content integrity rules from `site.ts` apply here verbatim: no invented
 * clients, metrics, license numbers or portraits; regulatory numbers stay
 * factually identical to the English rows and name their authority.
 */

import { photo } from './media';
import type { SiteContent } from './site';

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES — built first so the contact-form options can reference them
   ═══════════════════════════════════════════════════════════════════════════ */

const services: SiteContent['services'] = [
  {
    slug: 'reinforced-concrete-design',
    n: '01',
    title: 'Diseño de Concreto Reforzado',
    shortTitle: 'Diseño de Concreto Reforzado',
    track: 'new',
    summary:
      'Cimentaciones, columnas, vigas, losas y muros de corte diseñados como una sola trayectoria de carga — detallados para la obra y emitidos listos para permiso.',
    problem:
      'El concreto no perdona: un refuerzo que no se puede colocar, una condición de transferencia resuelta tarde o un espesor de losa fijado antes de conocer las cargas se convierten en problemas de obra que cuestan mucho más de lo que ahorraron. El diseño tiene que estar bien en el papel antes de estar bien en el encofrado.',
    audience: [
      'Desarrolladores y propietarios de edificios',
      'Arquitectos que llevan un proyecto a través del proceso de permisos',
      'Contratistas generales y subcontratistas de concreto',
    ],
    when: [
      'Está construyendo una casa, townhouses, un edificio de mediana altura o una estructura comercial y necesita el juego de planos estructurales para el permiso.',
      'Un arquitecto tiene un diseño y necesita la ingeniería estructural que lo respalde.',
      'Un contratista necesita detalles de refuerzo construibles, no un esquema.',
    ],
    capabilities: [
      'Cimentaciones',
      'Columnas y vigas',
      'Losas',
      'Muros de corte',
      'Detallado de refuerzo',
    ],
    scope: [
      'Sistema de gravedad — losas, vigas, vigas principales, columnas',
      'Sistema lateral — muros de corte, pórticos, diafragmas',
      'Cimentaciones — zapatas aisladas, losas de cimentación, vigas de amarre, cabezales de pilotes',
      'Condiciones de transferencia, aberturas y estructuración irregular',
      'Diseño de refuerzo, longitudes de desarrollo y detallado de empalmes',
      'RFIs en fase de construcción y revisión de submittals',
    ],
    process: [
      { step: 'Bajada de cargas', detail: 'Ocupación, carga muerta, viva, viento y sismo establecidas según ASCE 7 antes de dimensionar cualquier miembro.' },
      { step: 'Selección del sistema', detail: 'Distribución de la estructura, tipo de losa y estrategia lateral elegidos con el arquitecto — luz, peralte y costo evaluados en conjunto.' },
      { step: 'Análisis y dimensionamiento', detail: 'Miembros analizados y diseñados según ACI 318 y el Código de Construcción de Florida (FBC), con deflexión y condiciones de servicio verificadas.' },
      { step: 'Detallado', detail: 'Refuerzo dibujado de modo que realmente se pueda colocar — congestión, recubrimiento, ganchos y empalmes resueltos en el plano.' },
      { step: 'Revisión y sello', detail: 'Verificación interna independiente; luego firmado y sellado para la presentación del permiso.' },
    ],
    deliverables: [
      'Juego de planos estructurales, listo para permiso',
      'Memoria de cálculo estructural',
      'Notas generales y detalles típicos',
      'Documentos firmados y sellados donde el alcance lo requiera',
    ],
    nextStep:
      'Envíe los planos arquitectónicos (en cualquier etapa) y la ubicación del sitio. Recibirá una propuesta con alcance, entregables y honorarios.',
    considerations: [
      'El diseño de cimentaciones depende de un estudio geotécnico; donde no exista, le diremos qué se necesita antes de comenzar.',
      'El alcance y los honorarios cambian con la irregularidad — transferencias, voladizos, postensado y geometrías inusuales se cotizan con honestidad, no se absorben en silencio.',
      'Los comentarios de la revisión del permiso son parte del proceso; los respondemos, pero ningún ingeniero puede garantizar la decisión de una jurisdicción.',
    ],
    standards: ['ACI 318', 'ASCE 7', 'Florida Building Code'],
    seo: {
      title: 'Diseño de Concreto Reforzado',
      description:
        'Diseño de concreto reforzado para edificios en el Sur de Florida — cimentaciones, columnas, vigas, losas y muros de corte detallados según ACI 318 y el Código de Construcción de Florida, emitidos listos para permiso. Miami-Dade y Broward.',
      keywords: ['diseño de concreto reforzado', 'diseño de estructuras de concreto Miami', 'ingeniero estructural Miami', 'ingeniero estructural Broward'],
    },
  },
  {
    slug: 'structural-analysis',
    n: '02',
    title: 'Análisis Estructural y Cimentaciones',
    shortTitle: 'Análisis Estructural y Cimentaciones',
    track: 'new',
    summary:
      'Análisis de gravedad y lateral, demanda de viento y sismo, y el sistema de cimentación que lleva todo eso al terreno.',
    problem:
      'Cada edificio es una sola trayectoria de carga continua, del techo al suelo. Cuando el diseño por gravedad, el lateral y el de cimentaciones se tratan como ejercicios separados, las costuras entre ellos son donde viven las fallas y las órdenes de cambio.',
    audience: [
      'Equipos de diseño que necesitan un modelo estructural completo',
      'Propietarios que evalúan factibilidad u opciones estructurales',
      'Contratistas que evalúan la constructibilidad de un sistema',
    ],
    when: [
      'Necesita saber si un sitio, un estudio de suelos o un concepto de edificio funciona estructuralmente antes de comprometerse.',
      'El proyecto tiene un sitio difícil: lote estrecho, suelo de baja capacidad, nivel freático alto, vecinos muy cercanos.',
      'Necesita resolver la demanda de viento y lateral para un sitio en la Zona de Huracanes de Alta Velocidad (HVHZ).',
    ],
    capabilities: ['Modelado 3D', 'Demanda de viento y sismo', 'Control de deriva', 'Cimentaciones profundas', 'Verificación de asentamientos'],
    scope: [
      'Modelado analítico tridimensional de la estructura',
      'Demanda de viento y sismo según ASCE 7',
      'Selección del sistema lateral y control de deriva',
      'Verificación de diafragmas, colectores y continuidad de la trayectoria de carga',
      'Diseño de cimentaciones superficiales y profundas',
      'Verificación de asentamiento, capacidad portante y levantamiento contra el estudio geotécnico',
    ],
    process: [
      { step: 'Definir la demanda', detail: 'Categoría de riesgo, exposición, velocidad de viento y parámetros sísmicos fijados para el sitio real — no supuestos.' },
      { step: 'Construir el modelo', detail: 'Geometría, rigidez, restricciones y masa ensambladas en un solo modelo analítico de toda la estructura.' },
      { step: 'Analizar', detail: 'Se corren las combinaciones de carga por gravedad, viento y sismo; se verifican deriva, torsión y estabilidad.' },
      { step: 'Resolver la cimentación', detail: 'Reacciones llevadas a un sistema de cimentación acorde con el estudio de suelos y las restricciones del sitio.' },
      { step: 'Documentar', detail: 'Resultados trazados de vuelta a los planos y a una memoria de cálculo que un revisor puede seguir.' },
    ],
    deliverables: [
      'Modelo de análisis y resumen de resultados',
      'Documentación de cargas y combinaciones de carga',
      'Diseño de cimentaciones y tabla de reacciones',
      'Memoria de cálculo estructural',
    ],
    nextStep:
      'Comparta el sitio, el estudio geotécnico si lo tiene y el concepto del edificio. Le respondemos con lo que es factible y cuánto costará el análisis.',
    considerations: [
      'Las recomendaciones de cimentación son tan buenas como los datos geotécnicos que las respaldan.',
      'Las estructuras existentes requieren verificación en campo antes de que un modelo analítico sea confiable.',
      'Los resultados del análisis se reportan tal como son — incluso cuando muestran que un sistema no funciona.',
    ],
    standards: ['ASCE 7', 'ACI 318', 'AISC 360', 'Florida Building Code'],
    seo: {
      title: 'Análisis Estructural y Cimentaciones',
      description:
        'Análisis estructural y diseño de cimentaciones para el Sur de Florida — sistemas de gravedad y laterales, demanda de viento y sismo según ASCE 7, cimentaciones superficiales y profundas en Miami-Dade y Broward.',
      keywords: ['análisis estructural Sur de Florida', 'diseño de cimentaciones Miami', 'análisis de viento ASCE 7 Florida', 'diseño de sistema lateral'],
    },
  },
  {
    slug: 'bim-coordination',
    n: '03',
    title: 'Modelado y Coordinación BIM',
    shortTitle: 'Coordinación BIM',
    track: 'new',
    summary:
      'Modelos digitales coordinados que resuelven los conflictos antes de que lleguen a la obra y producen entregables estructurales más claros.',
    problem:
      'La mayoría de los conflictos entre estructura, arquitectura y MEP se descubren en obra, donde corregirlos cuesta más. Un modelo coordinado traslada ese descubrimiento al diseño, donde cuesta una conversación en lugar de una orden de cambio.',
    audience: [
      'Equipos de diseño que llevan coordinación multidisciplinaria',
      'Contratistas que requieren entregables basados en modelo',
      'Propietarios que quieren que el modelo de diseño sobreviva hasta la operación',
    ],
    when: [
      'El equipo del proyecto trabaja en Revit y necesita la estructura modelada con el mismo estándar.',
      'El propietario o el contratista exige un modelo federado e informes de interferencias como entregable.',
      'Ductos, tuberías y estructura siguen chocando en los planos y alguien tiene que hacerse cargo de la resolución.',
    ],
    capabilities: ['Modelado estructural', 'Federación de modelos', 'Detección de interferencias', 'Seguimiento de incidencias', 'Planos derivados del modelo'],
    scope: [
      'Modelado estructural — cimentaciones, columnas, losas, muros, estructuración',
      'Federación de los modelos estructural, arquitectónico y MEP',
      'Verificación de interferencias y seguimiento de su resolución',
      'Planos, tablas y cantidades derivados del modelo',
      'Reuniones de coordinación e informes de incidencias',
      'Entrega del modelo alineada a los requisitos de información del proyecto',
    ],
    process: [
      { step: 'Fijar las reglas', detail: 'Coordenadas compartidas, nomenclatura de niveles y ejes, desglose del modelo y nivel de información acordados antes de empezar a modelar.' },
      { step: 'Modelar la estructura', detail: 'El modelo estructural se construye como fuente del diseño, no como subproducto del dibujo.' },
      { step: 'Federar', detail: 'Modelos de las disciplinas combinados y verificados entre sí en un ciclo fijo.' },
      { step: 'Resolver', detail: 'Conflictos registrados, asignados y seguidos hasta su cierre — con la solución estructural diseñada, no improvisada.' },
      { step: 'Entregar', detail: 'Planos, tablas y el propio modelo emitidos como un solo conjunto consistente.' },
    ],
    deliverables: [
      'Modelo estructural al nivel de información acordado',
      'Informes de interferencias e incidencias con estado de resolución',
      'Planos y tablas derivados del modelo',
      'Registro de coordinación para el expediente del proyecto',
    ],
    nextStep:
      'Díganos qué software usa el equipo, el nivel de detalle requerido y el calendario de coordinación. Proponemos el alcance de modelado y el formato de intercambio.',
    considerations: [
      'La calidad de la coordinación depende de lo que entregan las demás disciplinas y de cuándo; el proceso es colaborativo por definición.',
      'Un modelo no sustituye un juego de planos firmado y sellado — lo respalda.',
      'El nivel de información debe corresponder a la decisión que se toma, no al número más alto disponible.',
    ],
    standards: ['ISO 19650', 'Coordinación basada en modelo'],
    seo: {
      title: 'Modelado y Coordinación BIM',
      description:
        'Modelado BIM estructural y coordinación multidisciplinaria — modelos Revit federados, detección de interferencias y entregables estructurales derivados del modelo para proyectos en el Sur de Florida.',
      keywords: ['coordinación BIM Miami', 'modelado BIM estructural', 'detección de interferencias estructural', 'ingeniero estructural Revit Florida'],
    },
  },
  {
    slug: 'peer-review',
    n: '04',
    title: 'Revisión por Pares y Cumplimiento',
    shortTitle: 'Revisión por pares',
    track: 'new',
    summary:
      'Una segunda lectura independiente del diseño estructural — cumplimiento de código, trayectoria de carga, constructibilidad y calidad de la documentación.',
    problem:
      'Cuando un problema estructural aparece en construcción, ya es un evento de cronograma. Una revisión independiente antes de emitir es la reducción de riesgo más barata disponible en un proyecto.',
    audience: [
      'Propietarios y desarrolladores que gestionan riesgo estructural',
      'Equipos de diseño que buscan una verificación independiente',
      'Prestamistas y aseguradoras que exigen revisión de terceros',
    ],
    when: [
      'Un prestamista, una aseguradora o un propietario exige una revisión estructural independiente antes de construir.',
      'Un juego de planos está por emitirse y nadie fuera del equipo de diseño lo ha leído.',
      'Algo en la estructura le preocupa y quiere que un segundo ingeniero lo mire, no que lo rediseñe.',
    ],
    capabilities: ['Revisión de planos', 'Verificación de cálculos', 'Continuidad de la trayectoria de carga', 'Constructibilidad', 'Registro de comentarios'],
    scope: [
      'Revisión independiente de planos y cálculos estructurales',
      'Verificación de cumplimiento de código y continuidad de la trayectoria de carga',
      'Revisión de las hipótesis de análisis y del modelado',
      'Revisión de constructibilidad y detallado',
      'Revisión de integridad y coordinación de la documentación',
      'Registro escrito de comentarios con seguimiento de resolución',
    ],
    process: [
      { step: 'Definir el alcance', detail: 'Profundidad acordada desde el inicio — revisión completa, sistemas específicos o una inquietud concreta.' },
      { step: 'Revisar', detail: 'Planos, cálculos y modelos leídos de forma independiente contra el código aplicable.' },
      { step: 'Comentar', detail: 'Hallazgos emitidos como un registro estructurado de comentarios, priorizados por consecuencia estructural.' },
      { step: 'Cerrar', detail: 'Respuestas revisadas y comentarios seguidos hasta su cierre para que el registro quede completo.' },
    ],
    deliverables: [
      'Informe de revisión independiente',
      'Registro de comentarios priorizados',
      'Seguimiento de resolución hasta el cierre',
    ],
    nextStep:
      'Envíe el juego de planos y los cálculos, e indique para qué es la revisión. Recibirá una propuesta con honorarios fijos para la profundidad de revisión que corresponda.',
    considerations: [
      'Una revisión por pares examina el diseño tal como fue presentado; no transfiere la responsabilidad del ingeniero de registro.',
      'La profundidad de la revisión y los honorarios escalan con el tamaño y la complejidad del juego de planos.',
      'Los comentarios se escriben para resolverse, no para asignar culpas.',
    ],
    standards: ['ACI 318', 'ASCE 7', 'AISC 360', 'Florida Building Code'],
    seo: {
      title: 'Revisión Estructural por Pares y Cumplimiento',
      description:
        'Revisión estructural independiente por pares — cumplimiento de código, trayectoria de carga, constructibilidad y revisión de documentación para proyectos en Miami-Dade y Broward.',
      keywords: ['revisión estructural por pares', 'revisión estructural independiente Florida', 'revisión estructural de terceros Miami', 'due diligence estructural'],
    },
  },
  {
    slug: 'building-recertification',
    n: '05',
    title: 'Recertificación de Edificios',
    shortTitle: 'Recertificación de Edificios',
    track: 'existing',
    summary:
      'Un camino claro desde la notificación del condado hasta el informe de recertificación estructural presentado — inspección, hallazgos, reparaciones, reinspección.',
    problem:
      'Una notificación de recertificación llega con un plazo, un formulario y muy poca explicación de lo que realmente tiene que ocurrir. Las juntas directivas y los propietarios necesitan a alguien que conozca la secuencia y pueda llevar la parte estructural de principio a fin.',
    audience: [
      'Asociaciones de condominio y de propietarios',
      'Administradores de propiedades',
      'Propietarios de edificios y gestores de activos',
    ],
    when: [
      'Llegó una notificación de recertificación de Miami-Dade o Broward, o el edificio se acerca a la edad en la que llegará.',
      'Un informe anterior identificó reparaciones y ahora el edificio debe reinspeccionarse y cerrarse.',
      'Está comprando o administrando un edificio y quiere saber en qué punto del ciclo de recertificación se encuentra.',
    ],
    capabilities: ['Revisión de la notificación', 'Inspección en sitio', 'Informe de hallazgos', 'Alcance de reparaciones', 'Reinspección'],
    scope: [
      'Revisión de la notificación, los registros del edificio e informes previos',
      'Inspección estructural visual del edificio',
      'Documentación de las condiciones observadas con fotografías',
      'Informe de recertificación estructural en el formulario requerido',
      'Recomendaciones de reparación donde las condiciones lo requieran',
      'Reinspección tras las reparaciones y apoyo en la presentación',
    ],
    process: [
      { step: 'Revisión de la notificación', detail: 'Leemos la notificación y el historial del edificio, y confirmamos qué está pidiendo realmente la jurisdicción y para cuándo.' },
      { step: 'Inspección en sitio', detail: 'Inspección estructural visual de los elementos accesibles — estructura, losas, balcones, estructura de techo y cimentaciones donde estén expuestas.' },
      { step: 'Hallazgos', detail: 'Condiciones observadas documentadas y clasificadas, con el razonamiento estructural escrito en lenguaje claro para la junta directiva.' },
      { step: 'Reparaciones', detail: 'Donde se requieran reparaciones, describimos qué debe corregirse y con qué estándar, para que el trabajo pueda licitarse con justicia.' },
      { step: 'Reinspección', detail: 'Las reparaciones terminadas se reinspeccionan y documentan contra los hallazgos originales.' },
      { step: 'Presentación', detail: 'El informe se finaliza y se presenta, y respondemos a las preguntas que plantee la oficina revisora.' },
    ],
    deliverables: [
      'Informe de recertificación estructural en el formulario requerido',
      'Documentación fotográfica de las condiciones observadas',
      'Recomendaciones de reparación por escrito cuando apliquen',
      'Documentación de reinspección tras las reparaciones',
    ],
    nextStep:
      'Adjunte la notificación (o indíquenos la edad y la dirección del edificio). Confirmamos qué programa aplica y respondemos con una propuesta para la inspección y el informe.',
    timing: {
      checked: 'Septiembre de 2026',
      note: 'La recertificación del condado y la inspección milestone (hito estructural) del estado son obligaciones separadas. Un condominio en Miami-Dade o Broward puede deber ambas, con plazos distintos y en informes distintos. Qué programas alcanzan a su edificio se confirma antes de comenzar.',
      rows: [
        {
          jurisdiction: 'Condado de Miami-Dade',
          source: 'Código del Condado de Miami-Dade §8-11(f)',
          facts: [
            { k: 'Primer vencimiento', v: '30 años — 25 años para edificios a unas 3 millas o menos de la costa' },
            { k: 'Después', v: 'Cada 10 años, durante la vida de la estructura' },
            { k: 'Plazo para cumplir', v: '90 días desde la notificación del condado' },
            { k: 'Fuera del programa', v: 'Viviendas unifamiliares, dúplex y edificios de 10 ocupantes o menos y 2,000 pies cuadrados o menos' },
          ],
        },
        {
          jurisdiction: 'Condado de Broward',
          source: 'Building Safety Inspection Program (Board of Rules and Appeals)',
          facts: [
            { k: 'Primer vencimiento', v: '25 años' },
            { k: 'Después', v: 'Cada 10 años' },
            { k: 'Alcance', v: 'Estructural y eléctrico, reportados por separado por profesionales licenciados' },
          ],
        },
      ],
    },
    considerations: [
      'Los requisitos difieren entre Miami-Dade y Broward y entre municipios — la secuencia anterior es típica, no universal.',
      'La recertificación no es un evento único. Después del primer informe, el edificio vuelve a vencer cada diez años, durante la vida de la estructura.',
      'La recertificación cubre el alcance estructural; la recertificación eléctrica es una disciplina separada.',
      'Un informe documenta condiciones observadas. Ningún ingeniero puede garantizar cómo actuará una oficina revisora a partir de él.',
      'Las condiciones ocultas pueden requerir investigación adicional antes de poder extraer conclusiones.',
    ],
    standards: ['Florida Building Code', 'Requisitos de Miami-Dade y Broward'],
    seo: {
      title: 'Recertificación de Edificios — Miami-Dade y Broward',
      description:
        'Recertificación estructural de edificios en Miami-Dade (30 / 25 años) y Broward (25 años) — revisión de la notificación, inspección, hallazgos, recomendaciones de reparación, reinspección y presentación del informe por un P.E. de Florida.',
      keywords: ['recertificación de edificios Miami-Dade', 'recertificación de edificios Broward', 'recertificación 30 años Miami', 'recertificación 25 años Broward', 'informe de recertificación estructural'],
    },
  },
  {
    slug: 'building-safety-inspections',
    n: '06',
    title: 'Inspecciones Milestone y de Seguridad Estructural',
    shortTitle: 'Inspecciones milestone y de seguridad',
    track: 'existing',
    summary:
      'Inspecciones milestone (hito estructural) y de seguridad estructural que documentan la condición real — con hallazgos escritos para actuar, no para archivar.',
    problem:
      'Una inspección de seguridad que produce un informe vago no ayuda a nadie. Los propietarios necesitan saber qué se observó realmente, qué significa estructuralmente y qué tiene que pasar después.',
    audience: [
      'Asociaciones de condominio sujetas a inspección milestone',
      'Propietarios de edificios antiguos o costeros',
      'Administradores que preparan planes de capital',
    ],
    when: [
      'Su condominio o cooperativa tiene tres pisos habitables o más y se acerca a los 30 años — 25 cerca de la costa.',
      'Un informe de fase uno encontró deterioro y se ha requerido una investigación de fase dos.',
      'Balcones, pasillos o barandas muestran desprendimientos, grietas o manchas de corrosión y la junta directiva necesita la lectura de un ingeniero.',
    ],
    capabilities: ['Inspección estructural', 'Revisión de balcones y barandas', 'Mapeo de deterioro', 'Hallazgos priorizados'],
    scope: [
      'Inspección visual del sistema estructural principal',
      'Revisión estructural de balcones, pasillos y barandas',
      'Mapeo de deterioro del concreto — desprendimientos, grietas, manchas de corrosión',
      'Revisión del deterioro estructural relacionado con la impermeabilización',
      'Hallazgos priorizados y seguimiento recomendado',
      'Definición del alcance de la investigación de fase dos cuando se justifique',
    ],
    process: [
      { step: 'Revisión de registros', detail: 'Planos disponibles, informes previos e historial de reparaciones revisados antes de la visita al sitio.' },
      { step: 'Inspección en campo', detail: 'Inspección visual sistemática con documentación fotográfica y mapeo de ubicaciones.' },
      { step: 'Evaluación', detail: 'Observaciones evaluadas estructuralmente — distinguiendo lo cosmético de lo estructural, y lo urgente de lo que puede monitorearse.' },
      { step: 'Informe', detail: 'Hallazgos emitidos con prioridades claras y, donde se requiera, un alcance definido para investigación adicional.' },
    ],
    deliverables: [
      'Informe de inspección con registro fotográfico',
      'Hallazgos de condición organizados por prioridad',
      'Seguimiento recomendado o alcance de investigación adicional',
      'Documentos firmados y sellados donde el alcance lo requiera',
    ],
    nextStep:
      'Indíquenos la edad, la altura y la distancia a la costa del edificio. Confirmamos si aplica la inspección milestone y proponemos el alcance de la fase uno.',
    timing: {
      checked: 'Septiembre de 2026',
      note: 'La inspección milestone es una obligación estatal bajo el Estatuto de Florida 553.899 y es independiente de la recertificación del condado. Ambas pueden aplicar al mismo edificio, con plazos distintos.',
      rows: [
        {
          jurisdiction: 'Estado de Florida — inspección milestone',
          source: 'Florida Statute 553.899',
          facts: [
            { k: 'Aplica a', v: 'Edificios de condominio y cooperativa de tres pisos habitables o más' },
            { k: 'Primer vencimiento', v: 'Antes del 31 de diciembre del año en que el edificio cumple 30 años — 25 años donde la autoridad local lo exija por proximidad al agua salada' },
            { k: 'Después', v: 'Cada 10 años' },
            { k: 'Fase dos', v: 'Solo donde la fase uno encuentra deterioro estructural sustancial' },
          ],
        },
      ],
    },
    considerations: [
      'La inspección visual cubre condiciones accesibles y observables. El deterioro oculto puede requerir ensayos o demolición selectiva.',
      'Los requisitos de la inspección milestone dependen de la edad, la altura y la ubicación del edificio; la aplicabilidad se confirma caso por caso.',
      'Una inspección reporta la condición en un momento dado; no es una garantía de desempeño futuro.',
    ],
    standards: ['Florida Building Code', 'Florida Statute 553.899'],
    seo: {
      title: 'Inspecciones Milestone y de Seguridad Estructural',
      description:
        'Inspecciones milestone de Florida (F.S. 553.899) e inspecciones de seguridad estructural en el Sur de Florida — inspección estructural visual, documentación del deterioro del concreto y hallazgos priorizados por un P.E. licenciado.',
      keywords: ['inspección milestone Florida', 'inspección milestone Miami', 'inspección de seguridad de edificios Broward', 'inspección de balcones Miami', 'inspección estructural Sur de Florida'],
    },
  },
  {
    slug: 'structural-condition-assessments',
    n: '07',
    title: 'Evaluaciones Estructurales y Diseño de Reparaciones',
    shortTitle: 'Evaluaciones y reparaciones',
    track: 'existing',
    summary:
      'Lo que el edificio está haciendo realmente hoy — deterioro evaluado, capacidad verificada, reparaciones diseñadas para que puedan licitarse y construirse.',
    problem:
      'Grietas, desprendimientos y movimientos parecen alarmantes y significan cosas muy distintas. Antes de gastar en reparaciones, un propietario necesita saber qué condiciones afectan la capacidad y cuáles no — y luego necesita reparaciones especificadas con la precisión suficiente para cotizarlas.',
    audience: [
      'Propietarios que planifican reparaciones u obras de capital',
      'Compradores que realizan due diligence estructural',
      'Asociaciones que responden a hallazgos de inspección',
    ],
    when: [
      'Un informe de inspección o recertificación enumera reparaciones y las ofertas de los contratistas no son comparables porque nadie definió el alcance.',
      'Ha aparecido deterioro visible y alguien tiene que decir si afecta la estructura.',
      'Está comprando un edificio, agregando un piso, cambiando su uso o abriendo un vano en un muro o una losa.',
    ],
    capabilities: ['Evaluación en campo', 'Mapeo de deterioro', 'Evaluación de capacidad', 'Especificación de reparaciones'],
    scope: [
      'Evaluación en campo del sistema estructural en su estado actual',
      'Evaluación del deterioro del concreto y la corrosión del refuerzo',
      'Evaluación de capacidad de miembros existentes donde se requiera',
      'Evaluación de modificaciones, sobrecargas y cambios de uso',
      'Diseño de reparaciones — concepto, detalles y especificación',
      'Orientación sobre priorización y fases',
    ],
    process: [
      { step: 'Entender el edificio', detail: 'Planos originales, modificaciones e historial de reparaciones revisados; donde faltan planos, la estructura se verifica en campo.' },
      { step: 'Evaluar la condición', detail: 'Deterioro mapeado y su significado estructural evaluado elemento por elemento.' },
      { step: 'Evaluar la capacidad', detail: 'Donde la condición o el uso han cambiado, la capacidad remanente se verifica contra la demanda actual.' },
      { step: 'Diseñar la reparación', detail: 'Reparaciones descritas con el detalle suficiente para licitarse, ejecutarse e inspeccionarse — no dejadas como una recomendación general.' },
    ],
    deliverables: [
      'Informe de evaluación de condición',
      'Mapeo de deterioro y registro fotográfico',
      'Evaluación de capacidad donde se realice',
      'Planos y especificaciones de reparación',
    ],
    nextStep:
      'Envíe fotografías de las condiciones y cualquier informe previo. Le decimos si hace falta una visita al sitio y qué cubrirá la evaluación.',
    considerations: [
      'Las evaluaciones de estructuras existentes conllevan incertidumbre; donde importa, se recomiendan ensayos o calas exploratorias en lugar de darla por resuelta.',
      'La falta de documentación original aumenta la verificación en campo requerida.',
      'El diseño de reparaciones se define y cotiza por separado de la evaluación que lo origina.',
    ],
    standards: ['ACI 318', 'Práctica de reparación ACI', 'Florida Building Code'],
    seo: {
      title: 'Evaluaciones de Condición Estructural y Diseño de Reparaciones',
      description:
        'Evaluaciones de condición estructural, evaluación de capacidad y diseño de reparaciones de concreto para edificios existentes en el Sur de Florida — evaluación del deterioro, planos y especificaciones de reparación.',
      keywords: ['evaluación de condición estructural Miami', 'ingeniero de reparación de concreto Florida', 'diseño de reparación de balcones', 'evaluación de edificios existentes', 'due diligence estructural Miami'],
    },
  },
];

const caseStudies: SiteContent['caseStudies'] = [];

/* ═══════════════════════════════════════════════════════════════════════════
   BUNDLE
   ═══════════════════════════════════════════════════════════════════════════ */

export const es: SiteContent = {
  company: {
    legalName: 'Tercero Tablada Civil & Structural Engineering Inc.',
    name: 'Tercero Tablada Civil & Structural Engineering Inc.',
    shortName: 'Tercero Tablada',
    discipline: 'Ingeniería Civil y Estructural',
    url: 'https://ttcivilstructural.com',
    description:
      'Ingeniería estructural para el Sur de Florida — diseño estructural de edificios nuevos, evaluación de edificios existentes, recertificación de edificios, inspecciones milestone y de seguridad, y coordinación BIM en Miami-Dade y Broward.',
    tagline: 'Ingeniería Estructural para el Sur de Florida.',
    logo: {
      lockupDark: '/ttc/img/logo-horizontal.png',
      lockupLight: '/ttc/img/logo-white-wide.png',
      lockupSize: { w: 2172, h: 827 },
      dark: '/ttc/img/logo-square.png',
      light: '/ttc/img/logo-white.png',
      markSize: { w: 1254, h: 1254 },
    },
    /**
     * Florida Engineering Business Registry number (DBPR).
     *
     * This is the FIRM's registration, not the engineer's personal P.E. licence,
     * and it is the one that belongs in public view: it says the COMPANY may
     * legally offer engineering services in Florida, which is what a board or a
     * developer is actually hiring. Verified 2026-09-12 in the DBPR registry —
     * #40285, status Current, no expiry (the Certificate of Authorization was
     * replaced by a free, non-renewing registry in October 2019).
     *
     * Kept in English in both languages: it is the official designation someone
     * would type into myfloridalicense.com to verify it. `null` removes the line
     * from the footer entirely.
     */
    registry: 'FL Engineering Business No. 40285' as string | null,
  },

  contact: {
  /**
     * The firm's mailbox. Google Workspace on ttcivilstructural.com — MX
     * verified live 2026-09-12 (smtp.google.com), single root SPF
     * (include:_spf.google.com), so this address genuinely receives.
     *
     * It replaced info@tercerotablada.com, which was published here for months
     * on a domain with NO MX at all: anyone who wrote to it got a bounce and
     * assumed they had reached us. Before changing this, dig the MX.
     */
    email: 'info@ttcivilstructural.com',
    phone: null,
    address: null,
    serviceAreaLabel: 'Condados de Miami-Dade y Broward, Florida',
    social: {
      linkedin: null,
    },
    responseNote:
      'Cada consulta la lee y la responde el ingeniero, no un centro de llamadas.',
  },

  primaryNav: [
    { href: '/services', label: 'Servicios' },
    { href: '/existing-buildings', label: 'Edificios existentes' },
    { href: '/projects', label: 'Proyectos' },
    { href: '/about', label: 'Nosotros' },
    { href: '/contact', label: 'Contacto' },
  ],

  primaryCta: { href: '/contact', label: 'Solicitar propuesta' },

  footerNav: [
    {
      title: 'Navegar',
      items: [
        { href: '/services', label: 'Servicios' },
        { href: '/existing-buildings', label: 'Edificios existentes' },
        { href: '/projects', label: 'Proyectos' },
        { href: '/about', label: 'Nosotros' },
        { href: '/about#engineer', label: 'Conozca al ingeniero' },
        { href: '/contact', label: 'Solicitar propuesta' },
      ],
    },
  ],

  ui: {
    skipToContent: 'Ir al contenido',
    home: 'Inicio',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    siteMenu: 'Menú del sitio',
    primaryNavLabel: 'Principal',
    language: { label: 'Idioma', en: 'EN', es: 'ES', switchTo: 'View in English' },
    breadcrumb: 'Ruta de navegación',
    explore: 'Explorar',
    exploreService: 'Ver este servicio',
    learnMore: 'Más información',
    requestProposal: 'Solicitar propuesta',
    exploreServices: 'Explore nuestros servicios',
    seeAllServices: 'Todos los servicios',
    newProjects: 'Proyectos nuevos',
    existingBuildings: 'Edificios existentes',
    whenYouNeedIt: 'Cuándo lo necesita',
    whatsIncluded: 'Qué incluye',
    whatYouReceive: 'Qué recibe',
    nextStep: 'Siguiente paso',
    whenItApplies: 'Cuándo aplica',
    howItRuns: 'Cómo se desarrolla el trabajo',
    considerations: 'Conviene saber',
    designBasis: 'Base de diseño',
    relatedServices: 'Servicios relacionados',
    atAGlance: 'De un vistazo',
    service: 'Servicio',
    appliesTo: 'Aplica a',
    newConstruction: 'Construcción nueva',
    basis: 'Base',
    coverage: 'Cobertura',
    verified: 'Verificado',
    lastChecked: 'Última verificación',
    footer: {
      services: 'Servicios',
      contact: 'Contacto',
      navigate: 'Navegar',
      linkedin: 'LinkedIn',
      imageCredits: 'Créditos de imágenes',
    },
    engineer: {
      eyebrow: 'Conozca al ingeniero',
      eyebrowTeaser: 'Quién responde',
      role: 'Ingeniero Principal',
      credential: 'Ingeniero Profesional (P.E.) licenciado en Florida',
      license: 'Licencia P.E. de Florida',
      verify: 'Verificar en el DBPR de Florida',
      education: 'Formación',
      focus: 'Enfoque de la práctica',
      approach: 'Cómo trabajo',
      forYou: 'Qué significa eso para usted',
      readMore: 'Conozca al ingeniero',
      plateNote: 'Retrato profesional próximamente',
    },
    work: {
      projectType: 'Tipo de proyecto',
      location: 'Ubicación',
      problem: 'El problema',
      scope: 'Alcance',
      role: 'Nuestro rol',
      result: 'Resultado',
      structuralSystem: 'Sistema estructural',
      deliverables: 'Entregables',
      codes: 'Códigos',
      status: 'Estado',
      illustrative: 'Imagen ilustrativa — no es el proyecto descrito.',
      firmProjects: 'Proyectos de la firma',
      priorExperience: 'Experiencia profesional previa',
      priorNote:
        'Trabajo realizado en otras firmas antes de fundar la práctica. Se lista solo como experiencia — no son proyectos de Tercero Tablada Civil & Structural Engineering Inc.',
    },
    form: {
      heading: 'Solicitar propuesta',
      intro:
        'Cuéntenos qué posee, qué está planificando o qué recibió. Cuanto más específica sea la descripción, más precisa será la propuesta.',
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      company: 'Empresa o asociación',
      companyPlaceholder: 'Asociación, desarrollador, firma de arquitectura',
      service: 'Servicio requerido',
      selectService: 'Seleccione un servicio…',
      location: 'Ubicación del proyecto',
      locationPlaceholder: 'Ciudad o condado — p. ej. Coral Gables, Miami-Dade',
      message: 'Descripción del proyecto',
      messagePlaceholder:
        'Tipo de edificio, número de pisos, qué necesita diseñar o inspeccionar, y cualquier plazo o notificación con la que esté trabajando.',
      attachments: 'Archivos adjuntos',
      attachmentsHint:
        'Notificación municipal, fotografías o planos. PDF, imágenes, DWG, DXF o ZIP — hasta 25 MB cada uno, cinco archivos.',
      addFiles: 'Agregar archivos',
      removeFile: 'Quitar',
      uploading: 'Subiendo',
      optional: 'opcional',
      send: 'Enviar solicitud',
      sending: 'Enviando',
      sendAnother: 'Enviar otra solicitud',
      successTitle: 'Solicitud recibida.',
      successBody: 'Su solicitud está en la bandeja del ingeniero.',
    successConfirmed: 'Se envió una confirmación a su correo electrónico.',
      successRef: 'Referencia',
      whatNext: 'Qué sigue',
      nextSteps: [
        'El ingeniero lee su descripción y los archivos que haya adjuntado.',
        'Recibe una respuesta por correo electrónico con preguntas, o con una propuesta que establece el alcance, los entregables y los honorarios.',
        'El trabajo comienza una vez que el alcance se acuerda por escrito — nada se asume en su nombre.',
      ],
      directEmail: '¿Prefiere el correo electrónico? Escriba a',
      errors: {
        name: 'Por favor, ingrese su nombre',
        email: 'Por favor, ingrese un correo electrónico',
        emailFormat: 'Revise el correo electrónico',
        service: 'Seleccione el servicio que necesita',
        location: 'Indíquenos dónde está el proyecto o el edificio',
        message: 'Cuéntenos un poco más sobre el proyecto',
        generic: 'Algo salió mal. Por favor, escríbanos por correo electrónico.',
        upload: 'Ese archivo no se pudo subir.',
        fileType: 'Tipo de archivo no aceptado.',
        fileSize: 'Los archivos deben ser de 25 MB o menos.',
        fileCount: 'Hasta cinco archivos por solicitud.',
        tooMany: 'Demasiadas solicitudes desde esta conexión. Por favor, inténtelo de nuevo en unos minutos.',
      },
    },
    contactPage: {
      emailLabel: 'Correo electrónico',
      emailMeta: 'Ideal para preguntas de alcance, planos y permisos.',
      phone: 'Teléfono',
      office: 'Oficina',
      serviceArea: 'Área de servicio',
      serviceAreaMeta: 'Inspecciones en sitio y coordinación en todo el Sur de Florida.',
      whatWeCover: 'Qué cubrimos',
      disclaimer:
        'Las descripciones de este sitio son generales. El alcance, la secuencia y los entregables para cualquier edificio específico se confirman por escrito antes de comenzar el trabajo, y los requisitos varían según la jurisdicción.',
    },
    typologiesNote:
      'Las fotografías ilustran el tipo de estructura descrito. No son proyectos de Tercero Tablada — los casos de estudio publicados aparecen en',
    typologiesNoteLink: 'Proyectos',
    typologiesNoteEnd: ', con autorización del cliente.',
    galleryNote:
      'Fotografía arquitectónica con licencia, mostrada como material y no como portafolio. Ninguna imagen de esta página muestra un proyecto de Tercero Tablada.',
    processDisclaimer:
      'Los requisitos varían según la jurisdicción, la edad del edificio, el tipo de construcción y el alcance. Esto describe una secuencia típica, no un procedimiento ni un resultado garantizado.',
    legalPages: { privacy: 'Política de privacidad', terms: 'Términos de uso', legal: 'Legal' },
  },

  hero: {
    eyebrow: 'Miami-Dade · Broward · Ingeniero Profesional de Florida',
    title: 'Ingeniería Estructural para el Sur de Florida.',
    titleLines: ['Ingeniería Estructural', 'para el Sur de Florida.'],
    accentWord: 'Sur de Florida.',
    sub: 'Diseño estructural de edificios nuevos, evaluación de edificios existentes, recertificación de edificios y coordinación BIM — dirigidos por un Ingeniero Profesional (P.E.) licenciado en Florida que acompaña su proyecto desde la primera llamada hasta el informe final.',
    primary: { href: '/contact', label: 'Solicitar propuesta' },
    secondary: { href: '/services', label: 'Explore nuestros servicios' },
    caps: [
      'Diseño estructural',
      'Evaluación de edificios existentes',
      'Recertificación de edificios',
      'Coordinación BIM',
    ],
  },

  services,

  contactServiceOptions: [
    ...services.map((s) => s.shortTitle),
    'Otro / aún no estoy seguro',
  ],

  typologiesSection: {
    eyebrow: 'Qué diseñamos',
    title: 'De una vivienda unifamiliar a un edificio de mediana altura en concreto.',
    accentWord: 'mediana altura',
    lede: 'El mismo ingeniero, la misma trayectoria de carga, el mismo estándar de detallado — a la escala del edificio que tenemos enfrente. Si su proyecto no está en esta lista, vale más una conversación que una suposición.',
  },

  typologies: [
    { n: '01', title: 'Viviendas unifamiliares', lede: 'Casas nuevas diseñadas desde la zapata hacia arriba — cimentaciones dimensionadas según el estudio de suelos, una estructura que resiste el viento de huracán, y planos que un constructor local puede cotizar y construir.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.houseConcreteGarden },
    { n: '02', title: 'Townhouses y dúplex', lede: 'Muros medianeros, cimentaciones compartidas y crujías repetidas — la estructura resuelta una vez y detallada para que la repetición siga siendo un ahorro y no un riesgo.', track: 'new', href: '/services/structural-analysis', photo: photo.houseTownhouses },
    { n: '03', title: 'Concreto reforzado de mediana altura', lede: 'Losas planas, núcleos de muros de corte y balcones en voladizo — el sistema con el que se construye el Sur de Florida, diseñado como una sola trayectoria de carga continua.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.frameCurvedBalconies },
    { n: '04', title: 'Estructuras comerciales y de uso mixto', lede: 'Luces largas sobre el comercio de planta baja, estructura de transferencia donde cambia la retícula, y coordinación con todos cuyas instalaciones pasan por ella.', track: 'new', href: '/services/bim-coordination', photo: photo.frameCraneClean },
    { n: '05', title: 'Cimentaciones en sitios difíciles', lede: 'Lotes estrechos, suelo de baja capacidad, nivel freático alto y vecinos lo bastante cerca como para importar — la subestructura diseñada contra el estudio geotécnico, no a pesar de él.', track: 'new', href: '/services/structural-analysis', photo: photo.foundationMatPit },
    { n: '06', title: 'Reparaciones de estructuras existentes', lede: 'Balcones, fachadas, losas y columnas con décadas en servicio — condición documentada, reparaciones diseñadas, y la documentación que pide el condado.', track: 'existing', href: '/existing-buildings', photo: photo.facadeRepairRope },
  ],

  pathsSection: {
    eyebrow: 'Qué resolvemos',
    titleLines: ['Dos tipos de clientes.', 'Un solo ingeniero responsable de ambos.'],
    accentWord: 'ambos',
    lede: 'Algunos clientes están construyendo algo nuevo y necesitan que la estructura se diseñe y se permita. Otros poseen un edificio que ya está en pie y necesitan evaluarlo, recertificarlo o repararlo. Ambos reciben el mismo ingeniero, el mismo estándar de documentación y la misma línea directa.',
  },

  paths: [
    {
      n: '01',
      key: 'new',
      eyebrow: 'Proyectos nuevos',
      title: 'Estoy construyendo algo nuevo.',
      accentWord: 'nuevo',
      lede: 'Casas, townhouses, concreto de mediana altura y estructuras comerciales — diseñados desde la trayectoria de carga hasta el juego de planos sellado para permiso, y coordinados en BIM con el resto del equipo.',
      serviceSlugs: ['reinforced-concrete-design', 'structural-analysis', 'bim-coordination', 'peer-review'],
      cta: { href: '/services#new', label: 'Servicios para proyectos nuevos' },
      photo: photo.frameTowerSunlit,
    },
    {
      n: '02',
      key: 'existing',
      eyebrow: 'Edificios existentes',
      title: 'Soy dueño o administro un edificio existente.',
      accentWord: 'existente',
      lede: 'Notificaciones de recertificación, inspecciones milestone, deterioro visible y alcances de reparación — condición documentada, reparaciones diseñadas, y una ruta clara para cumplir con Miami-Dade y Broward.',
      serviceSlugs: ['building-recertification', 'building-safety-inspections', 'structural-condition-assessments'],
      cta: { href: '/existing-buildings', label: 'Servicios para edificios existentes' },
      photo: photo.midriseBalconies,
    },
  ],

  recertBand: {
    eyebrow: 'Edificios existentes',
    titleLines: ['Miles de edificios.', 'Un plazo para cada uno.'],
    accentWord: 'plazo',
    plainTitle: 'Miles de edificios. Un plazo para cada uno.',
    body: 'Los programas de recertificación del Sur de Florida alcanzan a la mayoría de los edificios entre los 25 y los 30 años de edad y regresan cada diez años durante la vida de la estructura. Llevamos la parte estructural de principio a fin: inspección, hallazgos, alcance de reparaciones, reinspección, presentación.',
    facts: [
      { k: 'Miami-Dade', v: '30 años · 25 cerca de la costa · luego cada 10' },
      { k: 'Broward', v: '25 años · luego cada 10' },
      { k: 'Milestone estatal', v: 'Condominios de 3+ pisos · 30 años (25 por regla local) · luego cada 10' },
    ],
    cta: { href: '/existing-buildings', label: 'Servicios para edificios existentes' },
  },

  bim: {
    eyebrow: 'BIM / Coordinación digital',
    title: 'Conflictos resueltos en el modelo, no en su obra.',
    body: 'Construimos el modelo estructural como fuente del diseño, lo federamos con arquitectura y MEP, y seguimos cada interferencia hasta su cierre — para que los planos que usted permite sean los planos que se construyen.',
    notes: [
      'Un modelo como fuente del diseño, no como subproducto del dibujo.',
      'Conflictos encontrados y resueltos en coordinación, no en campo.',
      'Planos, tablas y cantidades derivados del mismo modelo.',
    ],
    cta: { href: '/services/bim-coordination', label: 'Coordinación BIM en detalle' },
  },

  software: {
    eyebrow: 'Software y estándares abiertos',
    title: 'El modelo tiene que sobrevivir a la entrega.',
    body: 'Trabajamos en las herramientas que el resto del equipo del proyecto ya usa, e intercambiamos a través de formatos abiertos para que el modelo no se convierta en un callejón sin salida cuando sale de nuestra oficina.',
    items: [
      { name: 'Revit', role: 'Modelado estructural', logo: '/ttc/img/software/revit.svg' },
      { name: 'Navisworks', role: 'Detección de interferencias', logo: '/ttc/img/software/navisworks.png' },
      { name: 'Autodesk', role: 'Plataforma', logo: '/ttc/img/software/autodesk.svg' },
      { name: 'CYPE', role: 'Análisis estructural', logo: '/ttc/img/software/cype.png' },
      { name: 'BCF', role: 'Intercambio de incidencias', logo: '/ttc/img/software/bcf.svg' },
      { name: 'buildingSMART', role: 'IFC / openBIM', logo: '/ttc/img/software/buildingsmart.png' },
    ],
    note: 'Los nombres de productos y logotipos son propiedad de sus respectivos titulares y se muestran para identificar el software utilizado en nuestro flujo de trabajo.',
  },

  howWeWork: {
    eyebrow: 'Cómo trabajamos',
    title: 'Cinco pasos. Usted siempre sabe en cuál está.',
    lede: 'La secuencia es la misma tanto si está permitiendo una estructura nueva como si está respondiendo a una notificación de recertificación. Lo que cambia es la profundidad del paso tres.',
    steps: [
      {
        n: '01',
        title: 'Consulta inicial',
        youDo: 'Describa el proyecto o el edificio y comparta lo que tenga — planos, fotos, la notificación.',
        youGet: 'Una conversación directa con el ingeniero y una primera lectura de lo que se necesita.',
      },
      {
        n: '02',
        title: 'Alcance y propuesta',
        youDo: 'Revise una propuesta escrita que establece alcance, entregables, exclusiones y honorarios.',
        youGet: 'Un documento que puede comparar, cuestionar y aprobar. Nada empieza antes de acordarlo.',
      },
      {
        n: '03',
        title: 'Evaluación o diseño',
        youDo: 'Dé acceso al sitio, o responda las preguntas de coordinación del arquitecto a medida que surjan.',
        youGet: 'Inspección y hallazgos para edificios existentes; análisis, modelado y detallado para los nuevos — con un avance que usted puede ver.',
      },
      {
        n: '04',
        title: 'Entrega',
        youDo: 'Reciba el informe o el juego de planos firmado y sellado, y los cálculos que lo respaldan.',
        youGet: 'Documentos escritos para actuar: una junta directiva puede leer los hallazgos, un contratista puede construir los detalles, un revisor puede seguir el razonamiento.',
      },
      {
        n: '05',
        title: 'Seguimiento',
        youDo: 'Reenvíe los comentarios del revisor, los RFIs del contratista o la solicitud de reinspección.',
        youGet: 'Respuestas del ingeniero que hizo el trabajo — durante los comentarios del permiso, las preguntas de construcción y, en edificios existentes, la reinspección y la presentación.',
      },
    ],
  },

  caseStudies,

  engagements: [
    { n: '01', title: 'Estructura residencial de mediana altura', projectType: 'Residencial — construcción nueva', location: 'Condado de Miami-Dade, FL', scope: 'Diseño estructural completo: sistemas de gravedad y laterales, cimentaciones, detallado', structuralSystem: 'Losa plana de concreto reforzado con núcleo de muros de corte', deliverables: 'Juego de planos estructurales · Memoria de cálculo · Notas generales', codes: 'ACI 318 · ASCE 7 · Florida Building Code', status: 'Alcance representativo' },
    { n: '02', title: 'Recertificación de condominio costero', projectType: 'Edificio existente — recertificación', location: 'Condado de Broward, FL', scope: 'Revisión de la notificación, inspección estructural, hallazgos, recomendaciones de reparación, reinspección', structuralSystem: 'Estructura de concreto reforzado con balcones en voladizo', deliverables: 'Informe de recertificación · Registro fotográfico · Alcance de reparaciones', codes: 'Florida Building Code · Requisitos de recertificación del condado', status: 'Alcance representativo' },
    { n: '03', title: 'Inspección estructural milestone', projectType: 'Edificio existente — inspección de seguridad', location: 'Sur de Florida', scope: 'Inspección estructural visual, mapeo de deterioro del concreto, hallazgos priorizados', structuralSystem: 'Estructura de concreto reforzado, losas postensadas', deliverables: 'Informe de inspección · Mapeo de deterioro · Alcance de seguimiento', codes: 'Florida Building Code · F.S. 553.899', status: 'Alcance representativo' },
    { n: '04', title: 'Sistema de cimentación para un sitio restringido', projectType: 'Construcción nueva — cimentaciones', location: 'Condado de Miami-Dade, FL', scope: 'Diseño de cimentaciones contra el estudio geotécnico, verificación de asentamiento y levantamiento', structuralSystem: 'Losa de cimentación con vigas de amarre; cimentaciones profundas en zonas de transferencia', deliverables: 'Planos de cimentación · Tabla de reacciones · Memoria de cálculo', codes: 'ACI 318 · ASCE 7 · Florida Building Code', status: 'Alcance representativo' },
    { n: '05', title: 'Coordinación BIM multidisciplinaria', projectType: 'Construcción nueva — coordinación', location: 'Sur de Florida', scope: 'Modelado estructural, federación de modelos, verificación de interferencias, seguimiento de incidencias', structuralSystem: 'Estructura de concreto reforzado con vigas de transferencia de gran luz', deliverables: 'Modelo estructural · Informes de interferencias e incidencias · Planos derivados del modelo', codes: 'Gestión de la información ISO 19650', status: 'Alcance representativo' },
    { n: '06', title: 'Revisión estructural independiente por pares', projectType: 'Revisión de diseño — terceros', location: 'Sur de Florida', scope: 'Revisión independiente de planos y cálculos, registro de comentarios, seguimiento hasta el cierre', structuralSystem: 'Concreto reforzado y acero estructural, sistema mixto', deliverables: 'Informe de revisión · Registro de comentarios priorizados · Registro de resolución', codes: 'ACI 318 · ASCE 7 · AISC 360 · Florida Building Code', status: 'Alcance representativo' },
  ],

  workSection: {
    eyebrowReal: 'Trabajos seleccionados',
    eyebrowRepresentative: 'Alcance representativo',
    engagementsNote:
      'Perfiles de encargos representativos — alcance, sistemas estructurales y entregables anonimizados, del tipo que la práctica lleva a cabo. Los casos de estudio con nombre se publican solo con autorización del cliente, y se etiquetan como proyectos de la firma o experiencia profesional previa.',
    galleryEyebrow: 'El material',
    galleryLede: 'Concreto reforzado, refuerzo, residencias y la costa sobre la que se levantan — el vocabulario del trabajo, sin pies de foto a propósito.',
  },

  credentials: {
    eyebrow: 'Estándares y responsabilidad',
    sealedDeliverables: true,
    sealingStatement:
      'Los entregables son firmados y sellados por Juan Tercero, PE., M.Sc., Ingeniero Profesional (P.E.) licenciado en Florida, donde el alcance del trabajo lo requiere.',
    items: [
      { k: 'Base de diseño', v: 'ACI 318', note: 'Diseño y detallado de concreto reforzado' },
      { k: 'Cargas', v: 'ASCE 7', note: 'Viento, sismo y combinaciones de carga' },
      { k: 'Código aplicable', v: 'Florida Building Code', note: 'Disposiciones estructurales y requisitos para edificios existentes' },
      { k: 'Diseño en acero', v: 'AISC 360', note: 'Se aplica donde el acero estructural está en el alcance' },
      { k: 'Coordinación', v: 'ISO 19650', note: 'Gestión de la información basada en modelo' },
      { k: 'Área de servicio', v: 'Miami-Dade & Broward', note: 'Jurisdicciones del Sur de Florida' },
    ],
  },

  leadership: {
    name: 'Juan Tercero, PE., M.Sc.',
    firstName: 'Juan',
    role: 'Ingeniero Principal · Fundador',
    credential: 'Ingeniero Profesional (P.E.) licenciado en Florida',
    portrait: null,
    license: null,
    linkedin: null,
    teaserTitle: 'Un solo ingeniero responsable de todo el proyecto.',
    teaser:
      'Cada proyecto en Tercero Tablada es diseñado, revisado y firmado por la misma persona. Usted habla con el ingeniero de registro desde la primera llamada, y la propuesta que aprueba es el alcance que se construye.',
    bio: [
      'Juan Tercero es Ingeniero Profesional (P.E.) licenciado en Florida y fundador de Tercero Tablada Civil & Structural Engineering Inc. Ingeniero civil de formación (Universidad Nacional de Ingeniería) con un Máster en Dirección de Proyectos de Construcción (Construction Project Management) por la Universidad de Barcelona, dirige personalmente cada encargo — desde la primera conversación con un propietario, una junta directiva o un arquitecto hasta el juego de planos sellado o el informe presentado.',
      'La práctica cubre las dos mitades del trabajo estructural en el Sur de Florida: el diseño de edificios nuevos de concreto reforzado, y la evaluación, recertificación y reparación de edificios que ya están en pie. Ambas se hacen con la misma disciplina — el razonamiento detrás de cada conclusión queda escrito, y nada sale de la oficina sin haberse revisado línea por línea.',
    ],
    education: [
      'Máster en Construction Project Management — Universidad de Barcelona',
      'Ingeniero Civil — Universidad Nacional de Ingeniería',
      'Ingeniero Profesional (P.E.) licenciado, Estado de Florida',
    ],
    focus: [
      'Diseño en concreto reforzado para casas, edificios de mediana altura y estructuras comerciales',
      'Recertificación, inspecciones milestone y evaluaciones de condición',
      'Modelado BIM estructural y coordinación multidisciplinaria',
      'Diseño por viento y lateral para la Zona de Huracanes de Alta Velocidad (HVHZ)',
    ],
    approach:
      'Prefiero explicar una decisión estructural en lenguaje claro antes que esconderla detrás de una referencia de código. Una junta directiva debe poder leer un informe de hallazgos y saber qué hacer a continuación; un contratista debe poder construir desde el plano sin llamar; y un revisor debe poder seguir el cálculo desde la carga hasta el detalle.',
    forYou: [
      { k: 'Comunicación directa', v: 'Usted habla con el ingeniero que está haciendo el trabajo — no con un gestor de cuentas que transmite preguntas.' },
      { k: 'Un alcance que se puede leer', v: 'Cada propuesta establece qué se incluye, qué no, qué recibe y cuánto cuesta, antes de que empiece cualquier cosa.' },
      { k: 'El criterio de un solo ingeniero', v: 'La persona que inspecciona el edificio o fija la base de diseño es la persona que firma el informe y responde al revisor.' },
    ],
    plate: [
      { k: 'Nombre', v: 'Juan Tercero, PE., M.Sc.' },
      { k: 'Licencia', v: 'Ingeniero Profesional, Florida' },
      { k: 'Rol', v: 'Ingeniero Principal · Fundador' },
      { k: 'Práctica', v: 'Tercero Tablada Civil & Structural Engineering Inc.' },
      { k: 'Región', v: 'Miami-Dade & Broward' },
    ],
  },

  aboutPage: {
    eyebrow: 'Sobre la práctica',
    titleLines: ['Una práctica estructural construida', 'alrededor de un ingeniero responsable.'],
    accentWord: 'responsable',
    plainTitle: 'Una práctica estructural construida alrededor de un ingeniero responsable.',
    sub: 'Tercero Tablada Civil & Structural Engineering Inc. diseña edificios nuevos de concreto reforzado y evalúa los que ya están en pie, en Miami-Dade y Broward — con el razonamiento detrás de cada conclusión escrito y un solo Ingeniero Profesional de Florida responsable de todo.',
    facts: [
      { k: 'Principal', v: 'Juan Tercero, PE., M.Sc.' },
      { k: 'Enfoque', v: 'Concreto · Edificios existentes · BIM' },
      { k: 'Región', v: 'Sur de Florida' },
    ],
    approach: {
      eyebrow: 'Enfoque',
      title: 'Revisado línea por línea, antes de salir.',
      body: [
        'Dos tipos de trabajo pasan por esta práctica, y se informan mutuamente. Diseñar estructuras nuevas enseña qué falla en campo; inspeccionar edificios que llevan décadas en pie enseña qué detallar de otra manera la próxima vez.',
        'Nuestro método parte del modelo. La estructura se modela, coordina y documenta como una sola fuente de verdad conectada, verificada contra la base de diseño, para que el diseño que se permite sea el diseño que se construye.',
        'En edificios existentes la misma disciplina se aplica a la inversa: el edificio se verifica en campo antes de analizarse, y nada se concluye a partir de un plano que no se haya confirmado en sitio.',
      ],
    },
    principles: {
      eyebrow: 'Principios',
      title: 'Cómo mantenemos el estándar.',
      items: [
        { k: 'Rigor', v: 'Cada miembro se analiza y se verifica contra el código aplicable antes de llegar a un plano.' },
        { k: 'Constructibilidad', v: 'Detalles que respetan la obra — construibles, secuenciables y claros para el contratista.' },
        { k: 'Coordinación', v: 'Estructura resuelta contra arquitectura e instalaciones desde temprano, para que los conflictos se detecten en el modelo y no en sitio.' },
        { k: 'Razonamiento documentado', v: 'Hipótesis, cargas y disposiciones de código quedan escritas, para que cualquier revisor pueda seguir el argumento.' },
        { k: 'Durabilidad', v: 'Diseñado para durabilidad y vida útil en un entorno costero, no solo para el primer día de ocupación.' },
      ],
    },
  },

  servicesPage: {
    eyebrow: 'Servicios',
    titleLines: ['Organizados por lo que usted necesita,', 'no por lo que hacemos.'],
    accentWord: 'necesita',
    plainTitle: 'Organizados por lo que usted necesita, no por lo que hacemos.',
    sub: 'Siete servicios en dos líneas. Si está construyendo algo, empiece por proyectos nuevos. Si posee o administra un edificio que ya está en pie, empiece por edificios existentes. Cada servicio dice cuándo lo necesita, qué incluye, qué recibe y qué hacer a continuación.',
    facts: [
      { k: 'Proyectos nuevos', v: '4 servicios' },
      { k: 'Edificios existentes', v: '3 servicios' },
      { k: 'Cobertura', v: 'Miami-Dade & Broward' },
    ],
    tracks: {
      new: {
        id: 'new',
        eyebrow: 'Proyectos nuevos',
        title: 'Usted está construyendo algo.',
        lede: 'Para propietarios, desarrolladores, arquitectos y contratistas con un proyecto en diseño o camino al permiso.',
      },
      existing: {
        id: 'existing',
        eyebrow: 'Edificios existentes',
        title: 'Usted posee o administra un edificio.',
        lede: 'Para asociaciones, administradores de propiedades y propietarios con una notificación, un plazo, deterioro visible o una reparación por definir.',
      },
    },
  },

  existingPage: {
    eyebrow: 'Edificios existentes',
    titleLines: ['El edificio', 'ya está en pie.'],
    accentWord: 'en pie.',
    plainTitle: 'El edificio ya está en pie.',
    sub: 'Recertificación, inspección milestone (hito estructural), evaluación estructural y diseño de reparaciones para edificios en servicio en Miami-Dade y Broward. Documentamos lo que realmente hay, explicamos qué significa estructuralmente y definimos el trabajo que sigue.',
    facts: [
      { k: 'Para', v: 'Asociaciones, propietarios, administradores' },
      { k: 'Cobertura', v: 'Miami-Dade & Broward' },
      { k: 'Resultado', v: 'Informes, alcances de reparación, reinspecciones' },
    ],
    triggers: {
      eyebrow: 'Cuándo llamar',
      title: 'Cuatro momentos que necesitan un ingeniero.',
      items: [
        { k: 'Llegó una notificación', v: 'Se ha emitido una notificación de recertificación o de inspección milestone y la junta directiva necesita contratar a un ingeniero estructural antes del plazo.' },
        { k: 'Deterioro visible', v: 'Han aparecido grietas, desprendimientos, manchas de corrosión o movimiento y alguien tiene que decir si afecta la capacidad.' },
        { k: 'Antes de gastar', v: 'Se están cotizando reparaciones y el alcance no ha sido definido por un ingeniero, así que las ofertas no son comparables.' },
        { k: 'Antes de comprar', v: 'Due diligence estructural en una adquisición, incluidas modificaciones y preguntas sobre cambio de uso.' },
      ],
    },
    servicesEyebrow: 'Servicios para edificios existentes',
    timeline: {
      eyebrow: 'Recertificación de edificios',
      title: 'Un camino claro desde la notificación hasta el cumplimiento.',
      lede: 'Miami-Dade exige la primera recertificación a los 30 años — 25 cerca de la costa; Broward a los 25; la inspección milestone estatal a los 30 para condominios de tres pisos habitables o más. Todas regresan cada diez años. Llevamos la parte estructural de principio a fin para que la junta directiva sepa qué sigue en cada etapa.',
      cta: { href: '/services/building-recertification', label: 'Recertificación en detalle' },
      steps: [
        { n: '01', title: 'Revisión de la notificación', detail: 'Leemos la notificación y el registro del edificio, confirmamos qué pide la jurisdicción y fijamos el calendario contra el plazo indicado.' },
        { n: '02', title: 'Inspección en sitio', detail: 'Inspección estructural visual de los elementos accesibles — estructura, losas, balcones, estructura de techo y cimentaciones expuestas — documentada en campo.' },
        { n: '03', title: 'Hallazgos', detail: 'Las condiciones observadas se clasifican y explican en un lenguaje con el que la junta directiva puede actuar, con fotografías vinculadas a ubicaciones.' },
        { n: '04', title: 'Reparaciones', detail: 'Donde se requieran reparaciones definimos qué debe corregirse y con qué estándar, para que el trabajo pueda licitarse y ejecutarse con justicia.' },
        { n: '05', title: 'Reinspección', detail: 'Las reparaciones terminadas se reinspeccionan y documentan contra los hallazgos originales antes de certificar nada.' },
        { n: '06', title: 'Presentación', detail: 'El informe se finaliza, se presenta, y respondemos a las preguntas que plantee la oficina revisora.' },
      ],
    },
  },

  workPage: {
    eyebrowReal: 'Trabajos seleccionados',
    eyebrowRepresentative: 'Capacidades representativas',
    titleLines: ['La estructura detrás', 'del proyecto.'],
    accentWord: 'proyecto.',
    plainTitle: 'La estructura detrás del proyecto.',
    subReal: 'Encargos estructurales en el Sur de Florida — el edificio, el problema, el alcance, nuestro rol y el resultado documentado.',
    subRepresentative:
      'Perfiles de encargos que describen los sistemas estructurales con los que trabajamos, el alcance que lleva cada uno y los documentos que resultan. Anonimizados por defecto; los casos de estudio con nombre se publican solo con autorización del cliente.',
    facts: [
      { k: 'Cobertura', v: 'Miami-Dade & Broward' },
      { k: 'Sistemas', v: 'Concreto reforzado, acero' },
    ],
  },

  contactPage: {
    eyebrow: 'Solicitar propuesta',
    titleLines: ['Cuéntenos sobre el edificio.', 'Respondemos con un alcance.'],
    accentWord: 'alcance.',
    plainTitle: 'Cuéntenos sobre el edificio. Respondemos con un alcance.',
    sub: 'Describa el proyecto, el edificio o la notificación que recibió — y adjunte lo que ya tenga. El ingeniero lee cada solicitud y responde con preguntas o con una propuesta escrita.',
  },

  serviceArea: {
    eyebrow: 'Dónde trabajamos',
    title: 'Diseñado para esta costa.',
    body: 'Viento de huracán, un entorno costero corrosivo, un nivel freático alto y un código moldeado por los tres. El Sur de Florida no es una condición de diseño genérica — es en la que trabajamos todos los días, en Miami-Dade y Broward.',
    counties: [
      { name: 'Condado de Miami-Dade', code: 'MDC', note: 'Zona de Huracanes de Alta Velocidad (HVHZ)' },
      { name: 'Condado de Broward', code: 'BRW', note: 'Zona de Huracanes de Alta Velocidad (HVHZ)' },
    ],
    note: 'El Sur de Florida desde el aire. La cobertura se define por jurisdicción, no por el encuadre de una fotografía.',
  },

  closingCta: {
    eyebrow: 'Siguiente paso',
    titleLines: ['Cuéntenos sobre el edificio.', 'Respondemos con un alcance.'],
    accentWord: 'alcance.',
    plainTitle: 'Cuéntenos sobre el edificio. Respondemos con un alcance.',
    body: 'Un proyecto nuevo, un edificio existente o una notificación con plazo — descríbalo y adjunte lo que tenga. El ingeniero le responde, con preguntas o con una propuesta escrita.',
    primary: { href: '/contact', label: 'Solicitar propuesta' },
    secondary: { href: '/about#engineer', label: 'Conozca al ingeniero' },
  },

  legal: {
    notice:
      'La información de este sitio es general y no constituye una opinión de ingeniería, un encargo profesional ni una declaración sobre un edificio específico. Los requisitos varían según la jurisdicción y el alcance.',
    contactFormNotice:
      'Enviar este formulario no crea una relación profesional de ingeniería. Usamos sus datos y archivos únicamente para responder a esta solicitud.',
    links: [
      { href: '/privacy', label: 'Política de privacidad' },
      { href: '/terms', label: 'Términos de uso' },
      { href: '/credits', label: 'Créditos de imágenes' },
    ],
    privacy: {
      title: 'Política de privacidad',
      sub: 'Qué recopilamos a través de este sitio web, por qué lo recopilamos y qué hacemos con ello.',
      sections: [
        { h: 'Qué recopilamos', p: 'La única información personal que recopila este sitio web es la que usted envía a través del formulario de solicitud de propuesta: su nombre, correo electrónico, teléfono y empresa opcionales, el servicio seleccionado, la ubicación del proyecto, la descripción que escribe y los archivos que adjunta.' },
        { h: 'Por qué la recopilamos', p: 'La usamos para responder a su solicitud y para entender el alcance de ingeniería sobre el que pregunta. No la vendemos, alquilamos ni compartimos con fines publicitarios.' },
        { h: 'Cómo se almacena', p: 'Las solicitudes se guardan en nuestra base de datos de proyectos y los adjuntos en almacenamiento de archivos en la nube, en una dirección que nunca se publica ni se enlaza; se envía una notificación por correo electrónico a la oficina a través de un proveedor de correo transaccional para que veamos su mensaje, y se le envía una confirmación a usted. El acceso se limita a las personas que lo necesitan para responderle.' },
        { h: 'Cuánto tiempo la conservamos', p: 'Las solicitudes se conservan mientras sean comercialmente relevantes y durante el tiempo que requiera cualquier encargo resultante. Puede pedirnos que eliminemos su solicitud y sus adjuntos en cualquier momento.' },
        { h: 'Cookies y analítica', p: 'Este sitio no instala cookies publicitarias ni de seguimiento. El área autenticada de gestión de proyectos de este dominio puede usar cookies para el inicio de sesión; esas son estrictamente necesarias para mantener una sesión activa y no se usan para perfilar a los visitantes del sitio público.' },
        { h: 'Sus opciones', p: 'Puede preguntarnos qué información tenemos sobre usted, pedir que se corrija o pedir que se elimine. Escriba a la dirección indicada abajo y le responderemos.' },
        { h: 'Cambios', p: 'Si esta política cambia, la actualizaremos en esta página.' },
      ],
    },
    terms: {
      title: 'Términos de uso',
      sub: 'La base sobre la que se ofrece la información publicada aquí.',
      sections: [
        { h: 'Información general únicamente', p: 'El contenido de este sitio web describe servicios en términos generales. No es una opinión de ingeniería, una recomendación para un edificio específico ni un sustituto de una evaluación en sitio. Nada de lo aquí publicado debe usarse como base para una decisión de construcción, reparación o cumplimiento.' },
        { h: 'Sin relación profesional', p: 'Visitar este sitio, leerlo o enviar el formulario de solicitud de propuesta no crea una relación profesional de ingeniería. Un encargo comienza solo cuando el alcance, los honorarios y los términos se acuerdan por escrito.' },
        { h: 'Resultados regulatorios', p: 'Los requisitos de inspección, recertificación y permisos varían según la jurisdicción, la edad del edificio, el tipo de construcción y el alcance. Las edades y los plazos publicados aquí fueron verificados en la fecha indicada junto a ellos y pueden cambiar. Las descripciones de cualquier proceso en este sitio son secuencias típicas, no garantías. No prometemos la aprobación de ningún departamento de construcción ni autoridad revisora.' },
        { h: 'Documentos sellados', p: 'Donde se requiera un documento firmado y sellado, se emite como entregable formal bajo un alcance de trabajo acordado. El contenido de este sitio web nunca es un entregable sellado.' },
        { h: 'Exactitud y disponibilidad', p: 'Mantenemos este sitio actualizado, pero no garantizamos que cada afirmación sea completa o esté libre de errores, ni que el sitio esté siempre disponible.' },
        { h: 'Propiedad intelectual', p: 'Los textos, dibujos y marcas de este sitio pertenecen a Tercero Tablada Civil & Structural Engineering Inc. salvo que se indique lo contrario, y no pueden reproducirse sin autorización.' },
      ],
    },
    contactHeading: 'Contacto',
  },
};
