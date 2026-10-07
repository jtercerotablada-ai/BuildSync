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
 *
 * Spanish style, so the copy does not read as a translation:
 *   • Sentence case in titles, service names and buttons ("Diseño de
 *     concreto reforzado", "Solicitar propuesta"); months in lowercase.
 *   • "y", never "&", inside Spanish text (the firm's legal name keeps its &).
 *   • "Inspección de hito (milestone)" on first mention, then "de hito".
 *   • The two county programs by their own names: "recertificación de
 *     edificios" (Miami-Dade) and "Programa de Inspección de Seguridad de
 *     Edificios (BSIP)" (Broward) on first mention, then "el BSIP". Never
 *     "recertificación" for Broward's program, except as the name people
 *     still give it.
 *   • "Con licencia", not "licenciado" (a degree title in Latin America);
 *     "la firma", not "la práctica"; "tramitar/obtener el permiso", never
 *     "permitir" (which means "to allow").
 *   • Avoid the "contra" calque of "checked against": "con base en",
 *     "según", "se compara con".
 */

import { photo } from './media';
import type { SiteContent } from './site';

/**
 * The same date as `regulatoryChecked` in site.ts, in Spanish (month in
 * lowercase). It feeds `timing.checked` of the three regulated services.
 * Move both together, and only after re-reading the sources.
 */
export const regulatoryChecked = '4 de octubre de 2026';

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES — built first so the contact-form options can reference them
   ═══════════════════════════════════════════════════════════════════════════ */

const services: SiteContent['services'] = [
  /* ── EXISTING BUILDINGS — listed first everywhere ───────────────────────
     Mirror of the same three blocks in site.ts: same order, same slugs, the
     same six row labels on the two county programs, and the same facts. The
     reasoning behind every number and every hedge is in the comments there;
     read them before amending a row. Only what is specific to the Spanish
     wording is noted here:

       • The official names a reader will see on the letter stay recognisable
         on first mention — "Notificación de Inspección Requerida (Notice of
         Required Inspection)", "Building Official (el funcionario de
         construcción)" — and are then used in the short form.
       • "Presentar el informe" for "file the report"; "con permiso" /
         "obtener los permisos", never "permitir".
       • "Deberían llegar" for the courtesy notices ("should arrive"): the
         code obliges the county to send them, not the owner to have them. */
  {
    slug: 'building-recertification',
    n: '01',
    title: 'Recertificación de edificios en Miami-Dade',
    shortTitle: 'Recertificación en Miami-Dade',
    track: 'existing',
    coverage: 'Condado de Miami-Dade, Florida',
    areaServed: ['Miami-Dade County, Florida'],
    summary:
      'Un camino claro desde la notificación de Miami-Dade hasta el cierre de la recertificación — inspección, informe estructural en el formulario del condado, alcance de reparaciones, reinspección.',
    problemTitle: 'Llega una notificación con un plazo.',
    problem:
      'La Notificación de Inspección Requerida (Notice of Required Inspection) trae formularios y muy poca explicación de lo que realmente tiene que ocurrir. Las juntas directivas y los propietarios necesitan a alguien que conozca la secuencia del condado y pueda llevar la parte estructural desde la primera visita al sitio hasta el informe que cierra la recertificación.',
    audience: [
      'Asociaciones de condominio, de cooperativa y de propietarios',
      'Administradores de propiedades',
      'Propietarios de edificios y administradores de activos',
    ],
    when: [
      'Llegó una Notificación de Inspección Requerida de su ciudad o del Condado de Miami-Dade — o un aviso de cortesía le anuncia que viene en camino.',
      /* "Cierra la recertificación", never a bare "cerrarse": that read as
         "the building must be shut down". */
      'Un informe anterior identificó reparaciones y la recertificación sigue abierta.',
      'Está comprando o administrando un edificio en Miami-Dade y quiere saber en qué punto del ciclo de recertificación se encuentra.',
    ],
    capabilities: ['Revisión de la notificación', 'Inspección estructural', 'Informe en el formulario del condado', 'Alcance de reparaciones', 'Reinspección'],
    scope: [
      'Revisión de la notificación, los registros del edificio y los informes previos',
      'Inspección estructural en sitio — estructura, losas, balcones, fachada, techo y cimentaciones',
      'Clasificación de las condiciones observadas según su importancia estructural',
      'Alcance de reparaciones definido para que los contratistas coticen el mismo trabajo',
      'Reinspección de las reparaciones terminadas',
      'Respuesta a las preguntas de la oficina revisora sobre el informe estructural',
    ],
    /* The county's order — see the EN block. Same six labels as Broward's. */
    process: [
      { step: 'Revisión de la notificación', detail: 'Leemos la notificación y el historial del edificio, y confirmamos qué está pidiendo el Building Official y para cuándo.' },
      { step: 'Inspección', detail: 'Inspección estructural en sitio — estructura, losas, balcones, fachada, techo y cimentaciones expuestas — documentada con fotografías vinculadas a su ubicación.' },
      { step: 'Informe presentado', detail: 'El informe estructural se prepara en el formulario del propio condado, firmado y sellado, y se presenta aunque enumere reparaciones. El condado pide el informe primero, no después de la obra.' },
      { step: 'Reparaciones con permiso', detail: 'Donde se requieran reparaciones, definimos qué debe corregirse para que los contratistas coticen el mismo trabajo. Las reparaciones que requieren permiso esperan a tenerlo y luego siguen su calendario.' },
      { step: 'Reinspección', detail: 'Las reparaciones terminadas se reinspeccionan, se documentan y se comparan con los hallazgos originales.' },
      { step: 'Cierre', detail: 'Un informe enmendado indica que las reparaciones están completas. Eso es lo que cierra la recertificación, hasta el siguiente ciclo.' },
    ],
    deliverables: [
      'Informe estructural de recertificación en el formulario del propio condado, firmado y sellado',
      'Registro fotográfico de las condiciones observadas',
      'Alcance de reparaciones por escrito, cuando se requieran',
      'Carta sobre si el edificio puede seguir ocupado durante las reparaciones, cuando se requiera',
      'Informe enmendado tras las reparaciones',
    ],
    nextStep:
      'Envíe la notificación — basta una foto tomada con el teléfono — o la dirección y el año de construcción. Confirmamos qué le está pidiendo el Building Official (el funcionario de construcción) y respondemos con una propuesta para la inspección y el informe estructural.',
    timing: {
      checked: regulatoryChecked,
      /* Corrected with the EN note: the county report SERVES AS the state
         milestone inspection; it is not a separate obligation. */
      note: 'La notificación la envía el Building Official de su ciudad, o el condado en las áreas no incorporadas, y el informe se presenta ante esa misma oficina. En edificios de condominio y cooperativa de tres pisos habitables o más, el informe de recertificación sirve como la inspección de hito (milestone) del estado, y los deberes de la junta directiva con los propietarios de las unidades bajo la ley estatal (Florida Statute 553.899) se mantienen: dentro de los 14 días de recibir la notificación, avisarles de la inspección requerida y de la fecha en que debe quedar completada; dentro de los 45 días de recibir el informe, enviar a cada propietario el resumen del ingeniero, colocarlo en un lugar visible de la propiedad y publicar el informe y el resumen en el sitio web de la asociación, cuando la asociación esté obligada a tener uno.',
      rows: [
        {
          jurisdiction: 'Condado de Miami-Dade',
          source: 'Código del Condado de Miami-Dade, Sección 8-11(f)',
          /* Same six labels, same order, as the Broward row. Numbers are
             identical to the EN row — amend both or neither. */
          facts: [
            { k: 'Aplica a', v: 'Casi todos los tipos de edificio — condominios, cooperativas, apartamentos, oficinas, comercios e industrias. Fuera del programa: viviendas unifamiliares, dúplex y edificios que tengan a la vez una carga de ocupantes de 10 o menos según el Código de Construcción de Florida y un área bruta de 2,000 pies cuadrados o menos.' },
            { k: 'Primer vencimiento', v: 'A los 30 años — 25 para edificios de condominio y cooperativa de tres pisos o más a 3 millas o menos de la costa. La edad se cuenta desde el año de construcción que figura en el registro del Property Appraiser (el tasador de propiedades del condado).' },
            { k: 'Después', v: 'Cada 10 años, durante la vida de la estructura.' },
            { k: 'Plazo para presentar', v: '90 días desde la Notificación de Inspección Requerida (Notice of Required Inspection). Los avisos de cortesía deberían llegar dos años y un año antes; no recibirlos no mueve el plazo.', filing: true },
            { k: 'Si hay reparaciones', v: '150 días desde la notificación para terminar las reparaciones que no requieren permiso y obtener los permisos de las demás. La obra con permiso sigue luego el calendario de su permiso, y un informe enmendado cierra la recertificación.' },
            { k: 'Condominios y cooperativas', v: 'La recertificación sirve como cumplimiento de la inspección de hito (milestone) del estado — no se presenta un informe de hito aparte.' },
          ],
        },
      ],
    },
    considerations: [
      /* A naming note, not a deadline — see the comment on the EN row in
         site.ts. The one place this page says "40 años". */
      'Todavía se la conoce como la “recertificación de 40 años” — la primera ahora vence antes, a las edades indicadas arriba.',
      /* Scope honesty: replaced "la recertificación eléctrica es una
         disciplina separada". */
      'El programa de Miami-Dade pide un informe estructural y un informe eléctrico. Nosotros preparamos el informe estructural; el informe eléctrico lo firma un profesional calificado en diseño eléctrico.',
      /* Threshold buildings: neutral on purpose, claims no credential. */
      'Los edificios de más de tres pisos o 50 pies se consideran “threshold buildings” (edificios de umbral), y su informe estructural debe prepararlo un ingeniero con las calificaciones adicionales que exige el Condado de Miami-Dade. Lo confirmamos para su edificio antes de presentar una propuesta.',
      'Los informes estructural y eléctrico se presentan en los formularios del propio condado; no se acepta el formulario de una firma. El paquete del condado también incluye certificados de la iluminación del estacionamiento y, donde el estacionamiento colinda con agua, de las barreras de protección.',
      'El edificio se evalúa según el código vigente cuando se construyó. La recertificación no exige llevarlo al código actual.',
      'El Building Official puede conceder una prórroga de hasta 60 días para presentar el informe o para obtener los permisos, a solicitud firmada y sellada del ingeniero en la que declare que el edificio puede seguir ocupado.',
      'El informe enmendado que cierra una recertificación lo emite el ingeniero o arquitecto que presentó el informe original. Si el suyo lo presentó otra firma, indíquelo al escribirnos — confirmamos qué hará falta para cerrarla antes de presentar una propuesta.',
      'Una condición que ponga en peligro la vida o la propiedad se informa al propietario y al Building Official; el ingeniero tiene el deber de hacerlo.',
      'Cada ciudad maneja sus propias notificaciones y su propia presentación, y puede tener formularios propios. Las preguntas sobre una notificación se dirigen a la oficina que la envió, y nosotros leemos primero la carta de su ciudad.',
      'Un informe documenta condiciones observadas; las ocultas pueden requerir investigación adicional, y ningún ingeniero puede garantizar cómo actuará una oficina revisora a partir de él.',
    ],
    crossLink: { text: '¿Su edificio está en Broward?', label: 'Vea el BSIP', slug: 'broward-bsip' },
    program: {
      id: 'miami-dade',
      eyebrow: 'Condado de Miami-Dade · Recertificación de edificios',
      /* "90 días" must always equal the row's "Plazo para presentar". */
      titleLines: ['Recertificación en Miami-Dade.', '90 días desde la notificación.'],
      accentWord: '90 días',
      lede: 'La recertificación de Miami-Dade alcanza a casi todos los edificios, salvo las viviendas unifamiliares y los dúplex. Envíenos la notificación de su ciudad o del condado: inspeccionamos el edificio, preparamos el informe estructural en el formulario del propio condado y lo acompañamos durante las reparaciones hasta el informe enmendado que la cierra.',
      steps: ['Revisión de la notificación', 'Inspección', 'Informe presentado', 'Reparaciones y cierre'],
      scopeNote:
        'El programa de Miami-Dade pide un informe estructural y un informe eléctrico. Nosotros preparamos el informe estructural; el informe eléctrico lo firma un profesional calificado en diseño eléctrico.',
      cta: 'Enviar la notificación de Miami-Dade',
      ctaNote: 'Basta una foto de la carta tomada con el teléfono. ¿Aún no tiene notificación? Envíe la dirección y el año de construcción.',
      detail: 'La recertificación en detalle',
    },
    /* No ages and no day counts in the description — see the EN block. */
    seo: {
      title: 'Recertificación de edificios en Miami-Dade — Ingeniero estructural',
      description:
        'Recertificación de edificios en Miami-Dade: revisión de la notificación, inspección e informe estructurales en el formulario del condado y reinspección.',
      keywords: ['recertificación de edificios Miami-Dade', 'ingeniero recertificación Miami-Dade', 'recertificación 40 años Miami', 'recertificación 30 años Miami', 'recertificación de condominios Miami', 'informe de recertificación estructural'],
    },
  },
  {
    slug: 'broward-bsip',
    n: '02',
    title: 'Programa de Inspección de Seguridad de Edificios (BSIP) de Broward',
    shortTitle: 'BSIP de Broward',
    track: 'existing',
    coverage: 'Condado de Broward, Florida',
    areaServed: ['Broward County, Florida'],
    summary:
      'Desde la Notificación de Inspección Requerida hasta la carta de finalización que cierra el expediente — inspección, informe estructural en el formulario oficial del programa, alcance de reparaciones, reinspección.',
    problemTitle: 'Una carta certificada con un plazo.',
    /* The one place this page says "40 años": as the name people still use,
       never as a trigger. The English program name appears once, because it
       is what the letter says. */
    problem:
      'El Programa de Inspección de Seguridad de Edificios (BSIP, por Building Safety Inspection Program) de Broward exige una inspección de seguridad, estructural y eléctrica, de los edificios antiguos de todo el condado. Lo redacta la Junta de Reglas y Apelaciones del Condado de Broward (Board of Rules and Appeals) y lo hace cumplir el Building Official (el funcionario de construcción) de su ciudad. Muchos propietarios todavía lo llaman la recertificación de 40 años, y buena parte de lo que se ha escrito sobre él describe reglas que ya cambiaron. Las juntas directivas y los propietarios necesitan a alguien que trabaje con la política vigente y pueda llevar la parte estructural desde la primera visita al sitio hasta el cierre.',
    audience: [
      'Asociaciones de condominio, de cooperativa y de propietarios',
      'Administradores de propiedades',
      'Propietarios de edificios de alquiler, comerciales y de uso mixto',
    ],
    when: [
      'Llegó una Notificación de Inspección Requerida de su ciudad — o el edificio se acerca a la edad en la que llegará.',
      'Un informe anterior identificó reparaciones y el expediente sigue abierto.',
      'Está comprando o administrando un edificio en Broward y quiere saber en qué punto del ciclo de inspección se encuentra.',
    ],
    capabilities: ['Revisión de la notificación', 'Inspección estructural', 'Informe en el formulario oficial', 'Alcance de reparaciones', 'Reinspección y cierre'],
    scope: [
      'Revisión de la notificación, los registros del edificio y los informes previos',
      'Inspección estructural en sitio — estructura, losas, balcones, escaleras, barandas, techo y cimentaciones, y el garaje de estacionamiento donde lo haya',
      'Clasificación de las condiciones observadas según su importancia estructural',
      'Alcance de reparaciones definido para que los contratistas coticen el mismo trabajo',
      'Reinspección de las áreas reparadas',
      'Respuesta a las preguntas del Building Official sobre el informe estructural',
    ],
    /* Same six labels as the Miami-Dade page; Broward's own content. */
    process: [
      { step: 'Revisión de la notificación', detail: 'Leemos primero la carta de su ciudad: la fecha en que se recibió, la fecha que fija y lo que el Building Official pide que se presente.' },
      { step: 'Inspección', detail: 'Un examen visual sistemático de la estructura en sitio, con ensayos o aperturas de acabados solo donde lo que vemos lo justifica.' },
      { step: 'Informe presentado', detail: 'Un informe narrativo escrito con fotografías a color, más el formulario estructural oficial de la Junta de Reglas y Apelaciones, firmado y sellado. Se presenta en cuanto está completo, aunque enumere reparaciones.' },
      { step: 'Reparaciones con permiso', detail: 'Donde se requieran reparaciones, definimos el trabajo para que los contratistas coticen el mismo alcance, y emitimos la carta firmada y sellada sobre si el edificio puede seguir ocupado mientras tanto. Las reparaciones esperan a tener sus permisos.' },
      { step: 'Reinspección', detail: 'Terminada la obra, se reinspeccionan las áreas señaladas en el informe original.' },
      { step: 'Cierre', detail: 'Un informe enmendado y una carta de finalización firmada y sellada se entregan al propietario y al Building Official. Eso cierra el expediente, hasta el siguiente ciclo.' },
    ],
    deliverables: [
      'Informe estructural en el formulario oficial del programa, con informe narrativo y fotografías a color, firmado y sellado',
      'Alcance de reparaciones por escrito, cuando se requieran',
      'Carta firmada y sellada sobre si el edificio puede seguir ocupado durante las reparaciones',
      'Informe enmendado y carta de finalización tras las reparaciones',
    ],
    nextStep:
      'Envíe la notificación — basta una foto tomada con el teléfono — o la dirección y el año del certificado de ocupación. Leemos lo que pide su ciudad y respondemos con una propuesta para la inspección y el informe estructural.',
    timing: {
      checked: regulatoryChecked,
      note: 'En edificios de condominio y cooperativa de tres pisos habitables o más, el informe del BSIP sirve como fase uno y fase dos de la inspección de hito (milestone) del estado, y los deberes de la junta directiva con los propietarios de las unidades bajo la ley estatal (Florida Statute 553.899) se mantienen: dentro de los 14 días de recibir la notificación, avisarles de la inspección requerida y de la fecha en que debe quedar completada; dentro de los 45 días de recibir el informe, enviar a cada propietario el resumen del ingeniero, colocarlo en un lugar visible de la propiedad y publicar el informe y el resumen en el sitio web de la asociación, cuando la asociación esté obligada a tener uno. El Building Official de su ciudad hace cumplir el programa, y la carta de su ciudad indica su propia fecha — por eso la leemos primero.',
      rows: [
        {
          jurisdiction: 'Condado de Broward',
          source: 'Junta de Reglas y Apelaciones del Condado de Broward, Política n.º 05-05 · Código de Construcción de Florida, Enmiendas del Condado de Broward, Sección 110.15',
          /* Same six labels, same order, as the Miami-Dade row. "Plazo para
             presentar" keeps BOTH hedges of the EN row (older guides say 90;
             the city's letter states its own date) — neither may be cut. The
             180 days run from RECEIVING the notice: "desde que se recibe". */
          facts: [
            { k: 'Aplica a', v: 'Casi todos los tipos de edificio, en todas las ciudades de Broward y en el área no incorporada. Fuera del programa: viviendas de una a cuatro familias de tres pisos habitables o menos, townhouses en dominio pleno (fee simple) y estructuras menores con un área de edificio inferior a 3,500 pies cuadrados.' },
            { k: 'Primer vencimiento', v: 'A los 25 años, contados desde el certificado de ocupación.' },
            { k: 'Después', v: 'Cada 10 años.' },
            { k: 'Plazo para presentar', v: '180 días desde que se recibe la Notificación de Inspección Requerida (Notice of Required Inspection). Las guías antiguas todavía dicen 90 días; la política vigente desde el 9 de agosto de 2024 da 180. La carta de su ciudad indica su propia fecha.', filing: true },
            { k: 'Si hay reparaciones', v: '180 días desde la fecha del informe, con permiso, salvo que el Building Official (el funcionario de construcción) de su ciudad fije otro plazo. Una reinspección, un informe enmendado y una carta de finalización firmada y sellada cierran el expediente.' },
            { k: 'Condominios y cooperativas', v: 'El informe del BSIP sirve como fase uno y fase dos de la inspección de hito (milestone) del estado.' },
          ],
        },
      ],
    },
    considerations: [
      'La Junta de Reglas y Apelaciones envía a cada ciudad su lista de edificios a más tardar en junio, y el Building Official envía las notificaciones por correo certificado de junio a agosto. No recibir la notificación no es excusa: la inspección, el informe y las reparaciones que correspondan se deben igual, y a tiempo.',
      /* "Una prórroga", never "una sola": the policy does not say whether
         more than one can be granted. */
      'El Building Official puede conceder una prórroga de hasta 60 días para presentar el informe.',
      /* Scope honesty — the same sentence as the Miami-Dade page. */
      'El programa de Broward pide un informe estructural y un informe eléctrico. Nosotros preparamos el informe estructural; el informe eléctrico lo firma un profesional calificado en diseño eléctrico.',
      /* Threshold buildings: neutral on purpose, claims no credential. */
      'Los edificios de más de tres pisos o 50 pies se consideran “threshold buildings” (edificios de umbral), y su informe estructural debe prepararlo un ingeniero con las calificaciones adicionales que exige el Condado de Broward. Lo confirmamos para su edificio antes de presentar una propuesta.',
      'Solo se aceptan los formularios estructural y eléctrico de la propia Junta de Reglas y Apelaciones — no el formulario de una firma — y se presentan además de un informe narrativo escrito con fotografías a color, no en su lugar.',
      'El edificio se evalúa según el código vigente cuando se construyó. El programa no exige llevarlo al código actual.',
      'Mientras duran las reparaciones, el ingeniero emite una carta firmada y sellada sobre si el edificio puede seguir ocupado.',
      'El informe enmendado y la carta de finalización los emite el profesional que inspeccionó el edificio y emitió el informe original. Si el suyo lo emitió otra firma, indíquelo al escribirnos — confirmamos qué hará falta para cerrar el expediente antes de presentar una propuesta.',
      'También quedan fuera del programa los edificios federales y del Estado de Florida, los edificios en tierras tribales soberanas, las escuelas de la Junta Escolar del Condado de Broward y los ferrocarriles. Los garajes de estacionamiento, las barandas de protección y los balcones, terrazas elevadas, muelles y muros de contención costeros (seawalls) que estén unidos a una estructura o la sostengan sí forman parte de la inspección.',
      'Una condición que ponga en peligro la vida o la propiedad se informa al propietario y al Building Official; el ingeniero tiene el deber de hacerlo.',
      'Cada ciudad maneja la presentación a su manera. Leemos primero la carta de su ciudad y trabajamos con la fecha que indica.',
      'Un informe documenta condiciones observadas; las ocultas pueden requerir investigación adicional, y ningún ingeniero puede garantizar cómo actuará una oficina revisora a partir de él.',
    ],
    crossLink: { text: '¿Su edificio está en Miami-Dade?', label: 'Vea la recertificación de Miami-Dade', slug: 'building-recertification' },
    program: {
      id: 'broward',
      eyebrow: 'Condado de Broward · Programa de Inspección de Seguridad de Edificios (BSIP)',
      /* "180 días" must always equal the row's "Plazo para presentar". */
      titleLines: ['BSIP de Broward.', '180 días desde la notificación.'],
      accentWord: '180 días',
      /* Shorter than a literal translation on purpose: 55 words at most, and
         the full program name is already in the label above it. */
      lede: 'El BSIP de Broward — muchos propietarios todavía lo llaman la recertificación de 40 años — alcanza a casi todos los tipos de edificio, en todas las ciudades. Envíenos la notificación de su ciudad: inspeccionamos el edificio, preparamos el informe estructural en el formulario oficial del programa y lo acompañamos durante las reparaciones y el cierre.',
      steps: ['Revisión de la notificación', 'Inspección', 'Informe presentado', 'Reparaciones y cierre'],
      scopeNote:
        'El programa de Broward pide un informe estructural y un informe eléctrico. Nosotros preparamos el informe estructural; el informe eléctrico lo firma un profesional calificado en diseño eléctrico.',
      cta: 'Enviar la notificación de Broward',
      ctaNote: 'Basta una foto de la carta tomada con el teléfono. ¿Aún no tiene notificación? Envíe la dirección y el año del certificado de ocupación.',
      detail: 'El BSIP en detalle',
    },
    /* The title leads with the words people type: "BSIP", "Broward" and the
       program's name. The English queries stay in the keywords — the letter
       is in English and so is most of what people search for. */
    seo: {
      title: 'BSIP de Broward: Programa de Inspección de Seguridad de Edificios',
      description:
        'Programa de Inspección de Seguridad de Edificios (BSIP) de Broward: notificación, inspección e informe estructurales en el formulario oficial y cierre.',
      keywords: ['ingeniero BSIP Broward', 'programa de inspección de seguridad de edificios Broward', 'inspección de edificios de 25 años Broward', 'BSIP Broward', 'Broward BSIP engineer', 'building safety inspection program Broward', 'recertificación 40 años Broward'],
    },
  },
  {
    /* Renamed from `building-safety-inspections` — see the EN block for why,
       and for what this page is now for. */
    slug: 'milestone-inspections',
    n: '03',
    title: 'Inspecciones de hito (milestone) y de seguridad estructural',
    shortTitle: 'Inspecciones de hito (milestone)',
    track: 'existing',
    summary:
      'La inspección de hito (milestone) de Florida explicada para su edificio, la investigación adicional cuando un informe la exige, y las inspecciones de seguridad estructural fuera del ciclo de un programa.',
    problemTitle: '¿Qué inspección debe el edificio?',
    problem:
      'La ley de inspecciones de hito de Florida se superpone con la recertificación de Miami-Dade y con el Programa de Inspección de Seguridad de Edificios (BSIP) de Broward, y es fácil concluir que un edificio debe dos inspecciones distintas: la del estado y la del condado. En Miami-Dade y en Broward, la inspección de hito se cumple a través del programa del condado. Lo que una junta directiva necesita es que alguien le diga qué reglas alcanzan a su edificio, qué se observó realmente y qué tiene que pasar después.',
    audience: [
      'Asociaciones de condominio y de cooperativa',
      'Compradores, prestamistas y aseguradoras',
      'Propietarios y administradores de edificios antiguos o costeros',
    ],
    when: [
      /* Was "…se acerca a los 30 años — 25 cerca de la costa": under state
         law 25 applies only where the local agency requires it. */
      'Su junta directiva necesita saber si la ley de inspecciones de hito de Florida alcanza al edificio, y cómo se cumple en su condado.',
      'Un informe encontró deterioro estructural sustancial, y hay que definir y realizar la investigación adicional que exige — ensayos o aperturas de acabados.',
      'No hay notificación, pero sí un motivo para revisar: una compra, deterioro visible, o la solicitud de un prestamista o de una aseguradora.',
    ],
    capabilities: ['Revisión de aplicabilidad', 'Inspección estructural', 'Investigación adicional', 'Hallazgos priorizados'],
    scope: [
      'Revisión de qué reglas alcanzan al edificio — la ley estatal de inspecciones de hito, el programa del condado, o ninguna',
      'Inspección visual del sistema estructural principal',
      'Revisión estructural de balcones, pasillos y barandas',
      'Mapeo de deterioro del concreto — desprendimientos, grietas, manchas de corrosión',
      'Investigación adicional donde un informe encontró deterioro estructural sustancial, con ensayos ubicados donde menos afecten',
      'Distinción entre lo cosmético y lo estructural, y entre lo urgente y lo que puede monitorearse',
    ],
    process: [
      { step: 'Aplicabilidad', detail: 'Confirmamos qué reglas alcanzan al edificio y qué pide la notificación, si la hay. Donde aplica el programa de un condado, el trabajo se hace bajo ese programa.' },
      { step: 'Revisión de registros', detail: 'Planos disponibles, informes previos e historial de reparaciones revisados antes de la visita al sitio.' },
      { step: 'Inspección en campo', detail: 'Inspección visual sistemática con documentación fotográfica y mapeo de ubicaciones.' },
      { step: 'Evaluación', detail: 'Observaciones evaluadas estructuralmente — distinguiendo lo cosmético de lo estructural, y lo urgente de lo que puede monitorearse. Donde el deterioro es sustancial, se define la investigación adicional.' },
      { step: 'Informe', detail: 'Hallazgos emitidos con prioridades claras y, para condominios y cooperativas, un resumen aparte que la junta directiva puede enviar a los propietarios de las unidades.' },
    ],
    deliverables: [
      'Informe de inspección con registro fotográfico',
      'Hallazgos de condición organizados por prioridad',
      'Resumen de hallazgos para los propietarios de las unidades, en condominios y cooperativas',
      'Alcance y hallazgos de la investigación adicional que la inspección exija',
      'Documentos firmados y sellados donde el alcance lo requiera',
    ],
    nextStep:
      'Indíquenos el condado, la edad y el número de pisos del edificio, y qué originó la pregunta — una notificación, un informe, una venta. Le respondemos con las reglas que aplican y una propuesta para la inspección.',
    timing: {
      checked: regulatoryChecked,
      /* The statute number stays in the row's `source`, not in the prose.
         Corrected with the EN note: the milestone inspection is met THROUGH
         the county program in both counties, not beside it. */
      note: 'En Miami-Dade y en Broward, la inspección de hito del estado se cumple a través del programa del condado. La recertificación de Miami-Dade sirve como cumplimiento de ella — allí no se presenta un informe de hito aparte — y el informe del BSIP de Broward sirve como su fase uno y su fase dos. El plazo de su notificación es el del programa del condado, y está en la página de ese condado. Los deberes de la junta directiva con los propietarios de las unidades aplican en ambos condados.',
      rows: [
        {
          jurisdiction: 'Estado de Florida — inspección de hito',
          source: 'Estatutos de Florida, Sección 553.899',
          facts: [
            { k: 'Aplica a', v: 'Edificios de condominio y cooperativa de tres pisos habitables o más' },
            { k: 'Primer vencimiento', v: 'A más tardar el 31 de diciembre del año en que el edificio cumple 30 años, contados desde el certificado de ocupación — 25 años donde la autoridad local lo exija, por condiciones como la proximidad al agua salada' },
            { k: 'Después', v: 'Cada 10 años' },
            { k: 'Fase dos', v: 'Solo donde la fase uno encuentra deterioro estructural sustancial' },
            { k: 'Propietarios de las unidades', v: 'Dentro de los 14 días de recibir la notificación, la asociación les avisa de la inspección requerida y de la fecha en que debe quedar completada; dentro de los 45 días de recibir el informe, envía a cada propietario el resumen del ingeniero, lo coloca en un lugar visible de la propiedad y publica el informe y el resumen en su sitio web, cuando esté obligada a tener uno' },
          ],
        },
      ],
    },
    considerations: [
      'La ley estatal alcanza solo a los edificios de condominio y cooperativa descritos arriba. Otros edificios pueden quedar igualmente dentro del programa de un condado, que cubre casi todos los tipos de edificio.',
      'La investigación adicional es tan limitada o tan extensa como lo exija el deterioro. Su alcance se define a partir de lo que encuentra la inspección, no antes.',
      'La inspección visual cubre condiciones accesibles y observables. El deterioro oculto puede requerir ensayos o demolición selectiva.',
      /* Neutral on purpose: states the counties' rule, claims no credential. */
      'Para edificios de más de tres pisos o 50 pies, cada condado exige calificaciones adicionales al ingeniero que firma el informe estructural. Lo confirmamos para su edificio antes de presentar una propuesta.',
      'Una inspección reporta la condición en un momento dado; no es una garantía de desempeño futuro.',
    ],
    seo: {
      title: 'Inspecciones de hito (milestone) — Miami-Dade y Broward',
      description:
        'Inspecciones de hito (milestone) para condominios y cooperativas en Miami-Dade y Broward: cómo las cumple el programa del condado, y la fase dos.',
      // "Milestone" stays in the keywords: people search it in English.
      keywords: ['inspección milestone Florida', 'inspección milestone Miami', 'inspección de hito Florida', 'inspección de hitos condominio', 'inspección milestone fase dos', 'inspección de balcones Miami', 'inspección estructural Sur de Florida'],
    },
  },
  {
    slug: 'structural-condition-assessments',
    n: '04',
    title: 'Evaluaciones estructurales y diseño de reparaciones',
    shortTitle: 'Evaluaciones y reparaciones',
    track: 'existing',
    summary:
      'Cómo se está comportando realmente el edificio hoy — deterioro evaluado, capacidad verificada, reparaciones diseñadas para que puedan cotizarse y construirse.',
    problemTitle: 'No toda grieta es un problema estructural.',
    problem:
      'Grietas, desprendimientos y movimientos parecen alarmantes y significan cosas muy distintas. Antes de gastar en reparaciones, un propietario necesita saber qué condiciones afectan la capacidad y cuáles no — y luego necesita reparaciones especificadas con la precisión suficiente para cotizarlas.',
    audience: [
      'Propietarios que planifican reparaciones u obras de capital',
      'Compradores que realizan due diligence estructural',
      'Asociaciones que responden a hallazgos de inspección',
    ],
    when: [
      'Un informe de recertificación, del BSIP o de inspección enumera reparaciones y las ofertas de los contratistas no son comparables porque nadie definió el alcance.',
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
      { step: 'Evaluar la capacidad', detail: 'Donde la condición o el uso han cambiado, la capacidad remanente se compara con la demanda actual.' },
      { step: 'Diseñar la reparación', detail: 'Reparaciones descritas con el detalle suficiente para cotizarse, ejecutarse e inspeccionarse — no dejadas como una recomendación general.' },
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
      'Las evaluaciones de estructuras existentes conllevan incertidumbre; donde importa, se recomiendan ensayos o aperturas exploratorias en lugar de dar la incertidumbre por resuelta.',
      'La falta de documentación original aumenta la verificación en campo requerida.',
      'El diseño de reparaciones se define y cotiza por separado de la evaluación que lo origina.',
    ],
    seo: {
      title: 'Evaluaciones estructurales y reparaciones — Miami-Dade y Broward',
      description:
        'Evaluaciones de condición estructural y diseño de reparaciones de concreto para edificios existentes del Sur de Florida: qué significa el daño y cómo repararlo.',
      keywords: ['evaluación de condición estructural Miami', 'ingeniero de reparación de concreto Florida', 'diseño de reparación de balcones', 'evaluación de edificios existentes', 'due diligence estructural Miami'],
    },
  },
  /* ── NEW PROJECTS ──────────────────────────────────────────────────────── */
  {
    slug: 'reinforced-concrete-design',
    n: '05',
    title: 'Diseño de concreto reforzado',
    shortTitle: 'Diseño de concreto reforzado',
    track: 'new',
    summary:
      'Cimentaciones, columnas, vigas, losas y muros de corte diseñados como una sola trayectoria de carga — detallados para la obra y emitidos listos para permiso.',
    problemTitle: 'El concreto se resuelve primero en el papel.',
    problem:
      'El concreto no perdona: un refuerzo que no se puede colocar, una condición de transferencia resuelta tarde o un espesor de losa fijado antes de conocer las cargas se convierten en problemas de obra que cuestan mucho más de lo que ahorraron.',
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
      { step: 'Bajada de cargas', detail: 'Ocupación, carga muerta, carga viva y viento de huracán establecidos para el sitio real antes de dimensionar cualquier miembro.' },
      { step: 'Selección del sistema', detail: 'Distribución de la estructura, tipo de losa y estrategia lateral elegidos con el arquitecto — luz, peralte y costo evaluados en conjunto.' },
      { step: 'Análisis y dimensionamiento', detail: 'Miembros analizados y diseñados según el Código de Construcción de Florida (FBC), con deflexión y condiciones de servicio verificadas.' },
      { step: 'Detallado', detail: 'Refuerzo dibujado de modo que realmente se pueda colocar — congestión, recubrimiento, ganchos y empalmes resueltos en el plano.' },
      { step: 'Revisión y sello', detail: 'Planos cotejados línea por línea con los cálculos; luego firmados y sellados para la presentación del permiso.' },
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
    seo: {
      title: 'Diseño de concreto reforzado — Miami-Dade y Broward',
      description:
        'Diseño de concreto reforzado en el Sur de Florida: cimentaciones, columnas, losas y muros de casas y edificios, con planos listos para el permiso.',
      keywords: ['diseño de concreto reforzado', 'diseño de estructuras de concreto Miami', 'ingeniero estructural Miami', 'ingeniero estructural Broward'],
    },
  },
  {
    slug: 'structural-analysis',
    n: '06',
    title: 'Análisis estructural y cimentaciones',
    shortTitle: 'Análisis estructural y cimentaciones',
    track: 'new',
    summary:
      'Análisis de gravedad y lateral, demanda de viento y sismo, y el sistema de cimentación que lleva todo eso al terreno.',
    problemTitle: 'Una sola trayectoria de carga, del techo al suelo.',
    problem:
      'Cuando el diseño por gravedad, el diseño por viento y las cimentaciones se tratan como ejercicios separados, es en las uniones entre ellos donde aparecen las fallas y las órdenes de cambio.',
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
      'Demanda de viento de huracán y lateral para el sitio real',
      'Selección del sistema lateral y control de deriva',
      'Verificación de diafragmas, colectores y continuidad de la trayectoria de carga',
      'Diseño de cimentaciones superficiales y profundas',
      'Verificación de asentamiento, capacidad portante y levantamiento con base en el estudio geotécnico',
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
    seo: {
      title: 'Análisis estructural y cimentaciones — Miami-Dade y Broward',
      description:
        'Análisis estructural y diseño de cimentaciones en Miami-Dade y Broward: viento de huracán, sistemas laterales y cimentaciones para sitios difíciles.',
      keywords: ['análisis estructural Sur de Florida', 'diseño de cimentaciones Miami', 'análisis de viento ASCE 7 Florida', 'diseño de sistema lateral'],
    },
  },
  {
    slug: 'bim-coordination',
    n: '07',
    title: 'Modelado y coordinación BIM',
    shortTitle: 'Coordinación BIM',
    track: 'new',
    summary:
      'Modelos digitales coordinados que resuelven los conflictos antes de que lleguen a la obra y producen entregables estructurales más claros.',
    problemTitle: 'Encuentre los conflictos antes de llegar a obra.',
    problem:
      'La mayoría de los conflictos entre la estructura, la arquitectura y las instalaciones mecánicas, eléctricas y de plomería se descubren en obra, donde corregirlos cuesta más. Un modelo coordinado traslada ese descubrimiento al diseño, donde cuesta una conversación en lugar de una orden de cambio.',
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
    seo: {
      title: 'Modelado y coordinación BIM — Miami-Dade y Broward',
      description:
        'Modelado BIM estructural y coordinación para proyectos en el Sur de Florida: modelos Revit, detección de interferencias y planos derivados del modelo.',
      keywords: ['coordinación BIM Miami', 'modelado BIM estructural', 'detección de interferencias estructural', 'ingeniero estructural Revit Florida'],
    },
  },
  {
    slug: 'peer-review',
    n: '08',
    title: 'Revisión por pares y cumplimiento',
    shortTitle: 'Revisión por pares',
    track: 'new',
    summary:
      'Una segunda lectura independiente del diseño estructural — cumplimiento de código, trayectoria de carga, constructibilidad y calidad de la documentación.',
    problemTitle: 'Una segunda lectura antes de emitir los planos.',
    problem:
      'Cuando un problema estructural aparece en construcción, ya es un evento de cronograma. Una revisión independiente antes de emitir el juego de planos es la reducción de riesgo más barata disponible en un proyecto.',
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
      'Revisión de las respuestas del equipo de diseño hasta cerrar cada comentario',
    ],
    process: [
      { step: 'Definir el alcance', detail: 'Profundidad acordada desde el inicio — revisión completa, sistemas específicos o una inquietud concreta.' },
      { step: 'Revisar', detail: 'Planos, cálculos y modelos revisados de forma independiente según el código aplicable.' },
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
    seo: {
      title: 'Revisión estructural por pares — Miami-Dade y Broward',
      description:
        'Revisión estructural independiente por pares en Miami-Dade y Broward: cumplimiento de código, trayectoria de carga, constructibilidad y documentación.',
      keywords: ['revisión estructural por pares', 'revisión estructural independiente Florida', 'revisión estructural de terceros Miami', 'due diligence estructural'],
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
    /* Existing buildings first, each county's program by its own name — the
       order the whole site follows. No number belongs here. */
    description:
      'Ingeniería estructural para el Sur de Florida — recertificación de edificios en Miami-Dade, el Programa de Inspección de Seguridad de Edificios (BSIP) en Broward, evaluaciones estructurales y diseño de reparaciones, y diseño estructural de edificios nuevos.',
    tagline: 'Ingeniería estructural para el Sur de Florida.',
    logo: {
      lockupDark: '/ttc/img/logo-horizontal.png',
      lockupLight: '/ttc/img/logo-white-wide.png',
      lockupSize: { w: 2172, h: 827 },
      dark: '/ttc/img/logo-square.png',
      light: '/ttc/img/logo-white.png',
      markSize: { w: 1254, h: 1254 },
      markDarkSm: '/ttc/img/logo-square@256.png',
      markLightSm: '/ttc/img/logo-white@256.png',
      lockupLightSm: '/ttc/img/logo-white-wide@640.png',
      markSmSize: { w: 256, h: 256 },
      lockupSmSize: { w: 640, h: 244 },
    },
    /**
     * Florida Engineering Business Registry number (DBPR).
     *
     * This is the FIRM's registration, not the engineer's personal P.E. license,
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
    language: {
      label: 'Idioma',
      en: 'EN',
      es: 'ES',
      switchTo: 'View in English',
      unavailable: 'Versión en inglés no disponible',
    },
    breadcrumb: 'Ruta de navegación',
    explore: 'Explorar',
    exploreService: 'Ver este servicio',
    learnMore: 'Más información',
    requestProposal: 'Solicitar propuesta',
    /* Infinitive, like "Solicitar propuesta" beside it. */
    exploreServices: 'Ver nuestros servicios',
    seeAllServices: 'Todos los servicios',
    newProjects: 'Proyectos nuevos',
    existingBuildings: 'Edificios existentes',
    whenYouNeedIt: 'Cuándo lo necesita',
    whatsIncluded: 'Qué incluye',
    whatYouReceive: 'Qué recibe',
    scopeAndDeliverables: 'Alcance y entregables',
    nextStep: 'Siguiente paso',
    whenItApplies: 'Cuándo aplica',
    howItRuns: 'Cómo se desarrolla el trabajo',
    considerations: 'Conviene saber',
    considerationsTitle: 'Qué cambia el alcance, y lo que ningún ingeniero puede prometer.',
    stepYourPart: 'Su parte',
    stepYouGet: 'Usted recibe',
    pauseMotion: 'Pausar video de fondo',
    typicalEngagements: 'Encargos típicos',
    relatedServices: 'Servicios relacionados',
    atAGlance: 'De un vistazo',
    appliesTo: 'Aplica a',
    newConstruction: 'Construcción nueva',
    coverage: 'Cobertura',
    verified: 'Verificado',
    lastChecked: 'Última verificación',
    sourceLabel: 'Fuente',
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
      credential: 'Ingeniero Profesional (P.E.) con licencia en Florida',
      license: 'Licencia P.E. de Florida',
      verify: 'Verificar en el DBPR de Florida',
      /* The DBPR page is in English only, so the option keeps its English
         name, glossed. */
      verifyHow: 'En la página del DBPR, elija “Search by License Number” (búsqueda por número de licencia) y escriba el número.',
      /* "Ingeniero", never "firmado por" — see the EN comment in site.ts. */
      label: 'Ingeniero',
      licensePrefix: 'Licencia de Florida',
      education: 'Formación',
      focus: 'Áreas de especialidad',
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
      status: 'Estado',
      illustrative: 'Imagen ilustrativa',
      firmProjects: 'Proyectos de la firma',
      priorExperience: 'Experiencia profesional previa',
      priorNote:
        'Trabajo realizado en otras empresas antes de fundar la firma. Se lista solo como experiencia — no son proyectos de Tercero Tablada Civil & Structural Engineering Inc.',
    },
    form: {
      heading: 'Solicitar propuesta',
      intro:
        'Cuéntenos sobre su edificio, lo que está planificando o la notificación que recibió. Cuanto más específica sea la descripción, más precisa será la propuesta.',
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
        'Tipo de edificio, número de pisos, qué necesita diseñar o inspeccionar, y cualquier plazo o notificación que tenga pendiente.',
      attachments: 'Archivos adjuntos',
      attachmentsHint:
        'Notificación municipal, fotografías o planos. PDF, imágenes, DWG, DXF o ZIP — hasta cinco archivos de 25 MB cada uno.',
      addFiles: 'Agregar archivos',
      removeFile: 'Quitar',
      retry: 'Reintentar',
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
      /* Mirror of `program` in site.ts. "Carta" throughout, the word the
         buttons use ("Basta una foto de la carta"); the date is written in
         the Spanish order. */
      program: {
        attachments: 'Suba la foto de la carta',
        attachmentsHint:
          'Basta una foto de la carta tomada con el teléfono; un PDF también sirve. Hasta cinco archivos de 25 MB cada uno.',
        location: 'Dirección del edificio',
        locationPlaceholder: 'Calle, número y ciudad',
        noticeDate: 'Fecha de la carta',
        noticeDatePlaceholder: 'Día, mes y año',
        stories: 'Número de pisos',
        message: 'Cuéntenos de su edificio',
        messagePlaceholder:
          'Qué tipo de edificio es y qué le ha pedido la ciudad o el condado. ¿Aún no tiene la carta? Indíquenos la antigüedad del edificio.',
      },
      errors: {
        name: 'Por favor, ingrese su nombre',
        email: 'Por favor, ingrese un correo electrónico',
        /* "Revise el correo electrónico" read as "check your inbox". */
        emailFormat: 'Revise la dirección de correo electrónico',
        service: 'Seleccione el servicio que necesita',
        location: 'Indíquenos dónde está el proyecto o el edificio',
        message: 'Cuéntenos un poco más sobre el proyecto — al menos una frase (12 caracteres o más)',
        messageOrNotice: 'Adjunte la carta o cuéntenos de su edificio en al menos una frase (12 caracteres o más)',
        generic: 'Algo salió mal. Por favor, escríbanos por correo electrónico.',
        network: 'No pudimos conectar con el servidor. Revise su conexión e inténtelo de nuevo, o escríbanos directamente por correo electrónico.',
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
      'Las fotografías ilustran el tipo de estructura descrito; ninguna muestra un proyecto de Tercero Tablada Civil & Structural Engineering Inc. Los encargos típicos se describen en',
    typologiesNoteLink: 'Proyectos',
    typologiesNoteEnd: '.',
    galleryNote:
      'Fotografía arquitectónica con licencia, mostrada como material y no como portafolio. Ninguna imagen de esta página muestra un proyecto de Tercero Tablada Civil & Structural Engineering Inc.',
    processDisclaimer:
      'Los requisitos varían según la jurisdicción, la edad del edificio, el tipo de construcción y el alcance. Esto describe una secuencia típica, no un procedimiento ni un resultado garantizado.',
    legalPages: { privacy: 'Política de privacidad', terms: 'Términos de uso', legal: 'Legal' },
    notFound: {
      eyebrow: 'Error 404',
      title: 'Esta página no existe.',
      sub: 'Puede que el enlace esté desactualizado o que la dirección tenga un error. Estas páginas le ayudarán a retomar el camino.',
      home: 'Inicio',
      services: 'Todos los servicios',
      contact: 'Solicitar propuesta',
      metaTitle: 'Página no encontrada',
    },
  },

  hero: {
    eyebrow: 'Miami-Dade · Broward · Ingeniero Profesional de Florida',
    title: 'Ingeniería estructural para el Sur de Florida.',
    titleLines: ['Ingeniería estructural', 'para el Sur de Florida.'],
    accentWord: 'Sur de Florida.',
    /* Kept short on purpose: a longer sub pushed the /es hero to 915px at
       1440×900 and clipped the caps strip below the fold. That is why
       Broward's program is "el BSIP" here and not its full Spanish name —
       the full name is the label of the section right under the hero, and
       this line is no longer than the one it replaced. No regulatory number
       in the hero, as in English. */
    sub: 'Recertificación de edificios en Miami-Dade, el BSIP de Broward y diseño estructural de edificios nuevos — a cargo de un Ingeniero Profesional (P.E.) con licencia en Florida, desde el primer contacto hasta el informe final.',
    primary: { href: '/contact', label: 'Solicitar propuesta' },
    secondary: { href: '/services', label: 'Ver nuestros servicios' },
    /* Four links — same hrefs as English; the hash ones are anchors on the
       home page and are not localized. The third label is the service's own
       short title: the literal "Evaluaciones y diseño de reparaciones" was
       ten characters longer than any English cap and would wrap the strip. */
    caps: [
      { label: 'Miami-Dade · Recertificación', href: '#miami-dade' },
      { label: 'Broward · BSIP', href: '#broward' },
      { label: 'Evaluaciones y reparaciones', href: '/services/structural-condition-assessments' },
      { label: 'Diseño de edificios nuevos', href: '#new-buildings' },
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
    lede: 'El mismo ingeniero y el mismo estándar de detallado, a la escala del edificio que tenemos enfrente. Si su proyecto no está en esta lista, vale más una conversación que una suposición.',
  },

  typologies: [
    { n: '01', title: 'Viviendas unifamiliares', lede: 'Casas nuevas diseñadas desde la zapata hacia arriba — cimentaciones dimensionadas según el estudio de suelos, una estructura que resiste el viento de huracán, y planos que un constructor local puede cotizar y construir.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.houseConcreteGarden },
    { n: '02', title: 'Townhouses y dúplex', lede: 'Muros medianeros, cimentaciones compartidas y crujías repetidas — la estructura resuelta una vez y detallada para que la repetición siga siendo un ahorro y no un riesgo.', track: 'new', href: '/services/structural-analysis', photo: photo.houseTownhouses },
    { n: '03', title: 'Concreto reforzado de mediana altura', lede: 'Losas planas, núcleos de muros de corte y balcones en voladizo — el sistema con el que se construye el Sur de Florida, diseñado como una sola trayectoria de carga continua.', track: 'new', href: '/services/reinforced-concrete-design', photo: photo.frameCurvedBalconies },
    { n: '04', title: 'Estructuras comerciales y de uso mixto', lede: 'Luces largas sobre el comercio de planta baja, estructura de transferencia donde cambia la retícula, y coordinación con todos cuyas instalaciones pasan por ella.', track: 'new', href: '/services/bim-coordination', photo: photo.frameCraneClean },
    { n: '05', title: 'Cimentaciones en sitios difíciles', lede: 'Lotes estrechos, suelo de baja capacidad, nivel freático alto y vecinos lo bastante cerca como para importar — la subestructura diseñada a partir del estudio geotécnico, no a pesar de él.', track: 'new', href: '/services/structural-analysis', photo: photo.foundationMatPit },
    { n: '06', title: 'Reparaciones de estructuras existentes', lede: 'Balcones, fachadas, losas y columnas con décadas en servicio — condición documentada, reparaciones diseñadas, y la documentación que pide el condado.', track: 'existing', href: '/existing-buildings', photo: photo.repairSoffitTrowel },
  ],

  /* The design side of the practice in ONE home-page section — see the
     banner over `newBuildings` in site.ts. It replaced `pathsSection`,
     `paths`, `recertBand` and `bim`, which are gone from both bundles. The
     headline is the approved "Qué diseñamos" line; the typology grid that
     also carries it now lives on /services. */
  newBuildings: {
    eyebrow: 'Edificios nuevos',
    title: 'De una vivienda unifamiliar a un edificio de mediana altura en concreto.',
    accentWord: 'mediana altura',
    body: 'Casas, townhouses, edificios de concreto de mediana altura y estructuras comerciales — cimentaciones, estructura y diseño por viento de huracán resueltos como una sola estructura y emitidos como un juego de planos firmado y sellado para el permiso. Construimos primero el modelo estructural y lo comparamos con el modelo del arquitecto y con los de las instalaciones mecánicas, eléctricas y de plomería, para que los conflictos se resuelvan en pantalla antes de convertirse en una orden de cambio en obra.',
    cta: { href: '/services#new', label: 'Servicios para proyectos nuevos' },
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
    lede: 'La secuencia es la misma tanto si está respondiendo a una notificación del condado como si está tramitando el permiso de una estructura nueva. Lo que cambia es la profundidad del paso tres.',
    steps: [
      {
        n: '01',
        title: 'Consulta inicial',
        youDo: 'Envíe la notificación, o describa el edificio o el proyecto, y comparta lo que tenga — fotos, planos, informes previos.',
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
        youGet: 'Inspección y hallazgos para edificios existentes; análisis, modelado y detallado para los nuevos — con las preguntas planteadas a medida que surgen, no guardadas para el final.',
      },
      {
        n: '04',
        title: 'Entrega',
        youDo: 'Revise el informe o el juego de planos firmado y sellado, y pregunte lo que no quede claro.',
        youGet: 'Documentos escritos para actuar: una junta directiva puede leer los hallazgos, un contratista puede construir los detalles, un revisor puede seguir el razonamiento.',
      },
      {
        n: '05',
        title: 'Seguimiento',
        youDo: 'Reenvíe los comentarios del revisor, los RFIs del contratista o la solicitud de reinspección.',
        /* "El cierre", not "la presentación": the report is filed before the
           repairs in both counties — see the EN step. */
        youGet: 'Respuestas del ingeniero que hizo el trabajo — durante los comentarios del permiso, las preguntas de construcción y, en edificios existentes, la reinspección y el cierre.',
      },
    ],
  },

  caseStudies,

  engagements: [
    { n: '01', title: 'Estructura residencial de mediana altura', projectType: 'Residencial — construcción nueva', location: 'Miami-Dade o Broward', scope: 'Diseño estructural completo: sistemas de gravedad y laterales, cimentaciones, detallado', structuralSystem: 'Losa plana de concreto reforzado con núcleo de muros de corte', deliverables: 'Juego de planos estructurales · Memoria de cálculo · Notas generales', status: 'Encargo típico' },
    /* 02 names both county programs and 03 is no longer a "milestone"
       inspection — see the comment over `engagements` in site.ts. */
    { n: '02', title: 'Recertificación o inspección BSIP de un condominio', projectType: 'Edificio existente — programa del condado', location: 'Miami-Dade o Broward', scope: 'Revisión de la notificación, inspección estructural, informe estructural en el formulario oficial, alcance de reparaciones, reinspección', structuralSystem: 'Estructura de concreto reforzado con balcones en voladizo', deliverables: 'Informe estructural en el formulario oficial · Registro fotográfico · Alcance de reparaciones', status: 'Encargo típico' },
    { n: '03', title: 'Inspección de seguridad estructural', projectType: 'Edificio existente — inspección de seguridad', location: 'Miami-Dade o Broward', scope: 'Inspección estructural visual, mapeo de deterioro del concreto, hallazgos priorizados', structuralSystem: 'Estructura de concreto reforzado, losas postensadas', deliverables: 'Informe de inspección · Mapeo de deterioro · Alcance de seguimiento', status: 'Encargo típico' },
    { n: '04', title: 'Sistema de cimentación para un sitio restringido', projectType: 'Construcción nueva — cimentaciones', location: 'Miami-Dade o Broward', scope: 'Diseño de cimentaciones con base en el estudio geotécnico, verificación de asentamiento y levantamiento', structuralSystem: 'Losa de cimentación con vigas de amarre; cimentaciones profundas en zonas de transferencia', deliverables: 'Planos de cimentación · Tabla de reacciones · Memoria de cálculo', status: 'Encargo típico' },
    { n: '05', title: 'Coordinación BIM multidisciplinaria', projectType: 'Construcción nueva — coordinación', location: 'Miami-Dade o Broward', scope: 'Modelado estructural, federación de modelos, verificación de interferencias, seguimiento de incidencias', structuralSystem: 'Estructura de concreto reforzado con vigas de transferencia de gran luz', deliverables: 'Modelo estructural · Informes de interferencias e incidencias · Planos derivados del modelo', status: 'Encargo típico' },
    { n: '06', title: 'Revisión estructural independiente por pares', projectType: 'Revisión de diseño — terceros', location: 'Miami-Dade o Broward', scope: 'Revisión independiente de planos y cálculos, registro de comentarios, seguimiento hasta el cierre', structuralSystem: 'Concreto reforzado y acero estructural, sistema mixto', deliverables: 'Informe de revisión · Registro de comentarios priorizados · Registro de resolución', status: 'Encargo típico' },
  ],

  workSection: {
    eyebrowReal: 'Trabajos seleccionados',
    engagementsNote:
      'Perfiles de encargos típicos, no proyectos anteriores concretos: el alcance, el sistema estructural y los entregables de cada tipo de trabajo que realiza la firma. Los casos de estudio con nombre se publican solo con autorización del cliente, y se identifican como proyectos de la firma o experiencia profesional previa.',
    galleryEyebrow: 'El material',
    galleryLede: 'Concreto reforzado, refuerzo, residencias y la costa sobre la que se levantan — el vocabulario del trabajo, sin pies de foto a propósito.',
  },

  credentials: {
    sealedDeliverables: true,
    sealingStatement:
      'Juan Tercero, PE., M.Sc., Ingeniero Profesional (P.E.) con licencia en Florida, firma y sella los entregables cuando el alcance del trabajo lo requiere.',
  },

  leadership: {
    name: 'Juan Tercero, PE., M.Sc.',
    firstName: 'Juan',
    role: 'Ingeniero Principal · Fundador',
    credential: 'Ingeniero Profesional (P.E.) con licencia en Florida',
    portrait: null,
    license: {
      number: 'PE 105256',
      url: 'https://www.myfloridalicense.com/wl11.asp?mode=0&SID=&brd=&typ=',
    },
    linkedin: null,
    teaserTitle: 'Un solo ingeniero responsable de todo el proyecto.',
    teaser:
      'En Tercero Tablada Civil & Structural Engineering Inc., cada proyecto lo diseña, revisa y firma la misma persona. Usted trata directamente con el ingeniero desde su primer mensaje, y el alcance que aprueba en la propuesta es el alcance que entregamos.',
    bio: [
      /* The Master's keeps the program's own name ("…en Construction Project
         Management", Universidad de Barcelona), the same in bio and education. */
      'Juan Tercero es Ingeniero Profesional (P.E.) con licencia en Florida y fundador de Tercero Tablada Civil & Structural Engineering Inc. Ingeniero civil de formación (Universidad Nacional de Ingeniería) con un Máster en Construction Project Management por la Universidad de Barcelona, dirige personalmente cada encargo — desde la primera conversación con un propietario, una junta directiva o un arquitecto hasta el juego de planos sellado o el informe presentado.',
      'La firma cubre las dos mitades del trabajo estructural en el Sur de Florida: el diseño de edificios nuevos de concreto reforzado, y la evaluación, recertificación y reparación de edificios que ya están en pie. Ambas se hacen con la misma disciplina — el razonamiento detrás de cada conclusión queda escrito, y nada sale de la oficina sin haberse revisado línea por línea.',
    ],
    education: [
      'Máster en Construction Project Management — Universidad de Barcelona',
      'Ingeniero Civil — Universidad Nacional de Ingeniería',
      'Ingeniero Profesional (P.E.) con licencia del Estado de Florida',
    ],
    focus: [
      'Recertificación en Miami-Dade, inspecciones del BSIP en Broward y evaluaciones de condición',
      'Diseño en concreto reforzado para casas, edificios de mediana altura y estructuras comerciales',
      'Modelado BIM estructural y coordinación multidisciplinaria',
      'Diseño por viento y lateral para la Zona de Huracanes de Alta Velocidad (HVHZ)',
    ],
    approach:
      'Prefiero explicar una decisión estructural en lenguaje claro antes que esconderla detrás de una referencia de código. Una junta directiva debe poder leer un informe de hallazgos y saber qué hacer a continuación; un contratista debe poder construir desde el plano sin llamar; y un revisor debe poder seguir el cálculo desde la carga hasta el detalle.',
    forYou: [
      { k: 'Comunicación directa', v: 'Usted habla con el ingeniero que está haciendo el trabajo — no con un ejecutivo de cuentas que transmite preguntas.' },
      { k: 'Un alcance que se puede leer', v: 'Cada propuesta establece qué se incluye, qué no, qué recibe y cuánto cuesta, antes de que empiece cualquier cosa.' },
      { k: 'El criterio de un solo ingeniero', v: 'La persona que inspecciona el edificio o fija la base de diseño es la persona que firma el informe y responde al revisor.' },
    ],
    plate: [
      { k: 'Nombre', v: 'Juan Tercero, PE., M.Sc.' },
      { k: 'Licencia', v: 'Ingeniero Profesional, Florida' },
      { k: 'Cargo', v: 'Ingeniero Principal · Fundador' },
      { k: 'Firma', v: 'Tercero Tablada Civil & Structural Engineering Inc.' },
      { k: 'Región', v: 'Miami-Dade y Broward' },
    ],
  },

  /* La empresa con la que se hacen las recertificaciones. Mismas reglas que
     en site.ts: empresa APARTE, un solo equipo, sin reparto de tareas
     impreso, y la última línea dice quién firma y QUÉ firma: el informe
     estructural. "Cada informe" contradecía las notas de alcance ("el
     informe eléctrico lo firma un profesional calificado en diseño
     eléctrico"); no quitar "estructural" hasta que el dueño lo defina. */
  partner: {
    eyebrow: 'Con quién trabajamos',
    kicker: 'Dos empresas con licencia',
    title: 'Un solo equipo en su edificio.',
    lede:
      'Realizamos las recertificaciones de Miami-Dade y las inspecciones BSIP de Broward junto a Precision Source Inc., contratista general y eléctrico certificado en Florida, con sede en Miami. Dos empresas con licencia que trabajan como un solo equipo, desde el aviso hasta el informe final.',
    licensesLabel: 'Licencias de Florida',
    verifyLead: 'Cada número de licencia abre la búsqueda de licencias del DBPR de Florida.',
    engineering: {
      role: 'Ingeniería estructural',
      licenseLabel: 'Ingeniero Profesional',
      registryLabel: 'Empresa de Ingeniería',
    },
    construction: {
      role: 'Contratista general y eléctrico',
      name: 'Precision Source Inc.',
      place: 'Miami, Florida',
      logo: { src: '/ttc/img/partners/precision-source.png', w: 640, h: 935 },
      licenses: [
        { label: 'Contratista General Certificado', number: 'CGC061867' },
        { label: 'Contratista Eléctrico Certificado', number: 'EC13010175' },
      ],
    },
    seal: {
      k: 'Firmado y sellado',
      v: 'Cada informe estructural lleva la firma y el sello de Juan Tercero, PE., M.Sc., Ingeniero Profesional de Florida.',
    },
  },
  aboutPage: {
    eyebrow: 'Sobre la firma',
    titleLines: ['Una firma de ingeniería estructural', 'con un solo ingeniero responsable.'],
    accentWord: 'responsable',
    sub: 'Tercero Tablada Civil & Structural Engineering Inc. diseña edificios nuevos de concreto reforzado y evalúa los que ya están en pie, en Miami-Dade y Broward — con el razonamiento detrás de cada conclusión escrito y un solo Ingeniero Profesional de Florida responsable de todo.',
    facts: [
      { k: 'Director', v: 'Juan Tercero, PE., M.Sc.' },
      { k: 'Enfoque', v: 'Concreto · Edificios existentes · BIM' },
      { k: 'Región', v: 'Sur de Florida' },
    ],
    approach: {
      eyebrow: 'Enfoque',
      title: 'Revisado línea por línea, antes de salir.',
      body: [
        'Por esta firma pasan dos tipos de trabajo, y cada uno enriquece al otro. Diseñar estructuras nuevas enseña qué falla en campo; inspeccionar edificios que llevan décadas en pie enseña qué detallar de otra manera la próxima vez.',
        'Nuestro método parte del modelo. La estructura se modela, coordina y documenta como una sola fuente de verdad conectada, verificada con la base de diseño, para que lo que se presenta a permiso esté completo y coordinado.',
        'En edificios existentes la misma disciplina se aplica a la inversa: el edificio se verifica en campo antes de analizarse, y nada se concluye a partir de un plano que no se haya confirmado en sitio.',
      ],
    },
    principles: {
      eyebrow: 'Principios',
      title: 'Cómo mantenemos el estándar.',
      items: [
        { k: 'Rigor', v: 'Cada miembro se analiza y se verifica según el código aplicable antes de llegar a un plano.' },
        { k: 'Constructibilidad', v: 'Detalles que respetan la obra — construibles, secuenciables y claros para el contratista.' },
        { k: 'Coordinación', v: 'La estructura se coordina con la arquitectura y las instalaciones desde el inicio, para que los conflictos se detecten en el modelo y no en sitio.' },
        { k: 'Razonamiento documentado', v: 'Hipótesis, cargas y disposiciones de código quedan escritas, para que cualquier revisor pueda seguir el argumento.' },
        { k: 'Durabilidad', v: 'Diseñado para durabilidad y vida útil en un entorno costero, no solo para el primer día de ocupación.' },
      ],
    },
  },

  servicesPage: {
    eyebrow: 'Servicios',
    titleLines: ['Organizados por lo que usted necesita,', 'no por lo que hacemos.'],
    accentWord: 'necesita',
    /* Existing buildings first, as in English: the page opens with them.
       The counts follow the `services` array (four and four). */
    sub: 'Ocho servicios en dos líneas. Si posee o administra un edificio que ya está en pie, empiece por edificios existentes. Si está construyendo algo, empiece por proyectos nuevos. Cada servicio dice cuándo lo necesita, qué incluye, qué recibe y qué hacer a continuación.',
    facts: [
      { k: 'Edificios existentes', v: '4 servicios' },
      { k: 'Proyectos nuevos', v: '4 servicios' },
      { k: 'Cobertura', v: 'Miami-Dade y Broward' },
    ],
    tracks: {
      existing: {
        id: 'existing',
        eyebrow: 'Edificios existentes',
        title: 'Usted posee o administra un edificio.',
        lede: 'Para asociaciones, administradores de propiedades y propietarios con una notificación del condado, un plazo, deterioro visible o una reparación por definir. Miami-Dade y Broward tienen cada uno su propio programa, y cada uno tiene aquí su propia página.',
      },
      new: {
        id: 'new',
        eyebrow: 'Proyectos nuevos',
        title: 'Usted está construyendo algo.',
        lede: 'Para propietarios, desarrolladores, arquitectos y contratistas con un proyecto en diseño o camino al permiso.',
      },
    },
  },

  existingPage: {
    eyebrow: 'Edificios existentes',
    titleLines: ['El edificio', 'ya está en pie.'],
    accentWord: 'en pie.',
    sub: 'Recertificación en Miami-Dade, el Programa de Inspección de Seguridad de Edificios (BSIP) de Broward, inspecciones de hito (milestone), evaluaciones estructurales y diseño de reparaciones para edificios ya en servicio. Documentamos lo que realmente hay, explicamos qué significa estructuralmente y definimos el trabajo que sigue.',
    facts: [
      { k: 'Para', v: 'Asociaciones, propietarios, administradores' },
      { k: 'Cobertura', v: 'Miami-Dade y Broward' },
      { k: 'Resultado', v: 'Informes, alcances de reparación, reinspecciones' },
    ],
    triggers: {
      eyebrow: 'Cuándo llamar',
      title: 'Cuatro situaciones en las que conviene llamar a un ingeniero.',
      items: [
        { k: 'Llegó una notificación', v: 'Llegó una Notificación de Inspección Requerida de su ciudad o de su condado — recertificación en Miami-Dade, el BSIP en Broward — y la junta directiva necesita contratar a un ingeniero estructural antes del plazo.' },
        { k: 'Deterioro visible', v: 'Han aparecido grietas, desprendimientos, manchas de corrosión o movimiento y alguien tiene que decir si afecta la capacidad.' },
        { k: 'Antes de gastar', v: 'Se están cotizando reparaciones y el alcance no ha sido definido por un ingeniero, así que las ofertas no son comparables.' },
        { k: 'Antes de comprar', v: 'Due diligence estructural en una adquisición, incluidas modificaciones y preguntas sobre cambio de uso.' },
      ],
    },
    servicesEyebrow: 'Servicios para edificios existentes',
    /* The one sequence both county programs share — NO age and NO deadline
       here; they are on each county's page. Step order and the six titles
       match the `process` of the two program pages. `cta` → Miami-Dade,
       `ctaSecondary` → Broward. See the EN comment in site.ts. */
    timeline: {
      eyebrow: 'Recertificación y BSIP',
      title: 'Un camino claro desde la notificación hasta el cierre.',
      lede: 'Miami-Dade lo llama recertificación de edificios; Broward, Programa de Inspección de Seguridad de Edificios. Las edades y los plazos son distintos, y los de cada condado están en su propia página. La secuencia es la misma: primero se presenta el informe, las reparaciones siguen con permiso, y un informe final cierra el expediente. Llevamos la parte estructural para que la junta directiva sepa qué sigue en cada etapa.',
      cta: { href: '/services/building-recertification', label: 'La recertificación de Miami-Dade en detalle' },
      ctaSecondary: { href: '/services/broward-bsip', label: 'El BSIP de Broward en detalle' },
      steps: [
        { n: '01', title: 'Revisión de la notificación', detail: 'Leemos la notificación y el registro del edificio, confirmamos qué pide el Building Official y fijamos el calendario en función de la fecha de la carta.' },
        { n: '02', title: 'Inspección', detail: 'Inspección estructural en sitio — estructura, losas, balcones, techo y cimentaciones expuestas — documentada en campo, con fotografías vinculadas a su ubicación.' },
        { n: '03', title: 'Informe presentado', detail: 'El informe estructural se prepara en el formulario oficial que exige el condado, en un lenguaje con el que la junta directiva puede actuar, y se presenta aunque enumere reparaciones.' },
        { n: '04', title: 'Reparaciones con permiso', detail: 'Donde se requieran reparaciones definimos qué debe corregirse y con qué estándar, para que el trabajo pueda cotizarse en igualdad de condiciones. La obra que requiere permiso espera a tenerlo.' },
        { n: '05', title: 'Reinspección', detail: 'Las reparaciones terminadas se reinspeccionan, se documentan y se comparan con los hallazgos originales.' },
        { n: '06', title: 'Cierre', detail: 'Un informe enmendado — en Broward, con una carta de finalización firmada y sellada — indica que las reparaciones están completas. Eso cierra el expediente hasta el siguiente ciclo.' },
      ],
    },
  },

  workPage: {
    eyebrowReal: 'Trabajos seleccionados',
    titleLines: ['La estructura detrás', 'del proyecto.'],
    accentWord: 'proyecto.',
    subReal: 'Encargos estructurales en el Sur de Florida — el edificio, el problema, el alcance, nuestro rol y el resultado documentado.',
    subRepresentative:
      'Perfiles de encargos típicos: el sistema estructural, el alcance y los documentos que produce cada tipo de trabajo. Describen lo que realiza la firma, no proyectos anteriores concretos. Los casos de estudio con nombre se publican solo con autorización del cliente.',
    facts: [
      { k: 'Cobertura', v: 'Miami-Dade y Broward' },
      { k: 'Sistemas', v: 'Concreto reforzado, acero' },
    ],
  },

  contactPage: {
    eyebrow: 'Solicitar propuesta',
    titleLines: ['Cuéntenos sobre el edificio.', 'Respondemos con un alcance.'],
    accentWord: 'alcance.',
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
    cities:
      'Incluye Miami, Miami Beach, Coral Gables, Doral, Hialeah, Aventura, Sunny Isles Beach, Fort Lauderdale, Hollywood, Hallandale Beach, Pompano Beach, Coral Springs y el resto de ambos condados.',
  },

  closingCta: {
    eyebrow: 'Siguiente paso',
    titleLines: ['Cuéntenos sobre el edificio.', 'Respondemos con un alcance.'],
    accentWord: 'alcance.',
    /* Leads with the notice, as in English: notice, existing building, new
       project. */
    body: 'Una notificación del condado en la mano, un edificio que le preocupa o un proyecto nuevo — descríbalo y adjunte lo que tenga. Basta una foto de la carta tomada con el teléfono. El ingeniero le responde, con preguntas o con una propuesta escrita.',
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
        { h: 'Qué recopilamos', p: 'La única información personal que recopila este sitio web es la que usted envía a través del formulario de solicitud de propuesta: su nombre, correo electrónico, teléfono y empresa opcionales, el servicio seleccionado, la dirección del edificio o la ubicación del proyecto, la descripción que escribe y los archivos que adjunta — y, cuando envía una notificación, su fecha y el número de pisos si usted los indica. Junto con la solicitud registramos también la página de este sitio por la que entró y la dirección de la página que enlazó hacia él, para saber cómo nos encuentran.' },
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
        { h: 'Propiedad intelectual', p: 'Los textos, el nombre y el logotipo de la firma que aparecen en este sitio pertenecen a Tercero Tablada Civil & Structural Engineering Inc. y no pueden reproducirse sin autorización. Las fotografías, los videos y las marcas de software de terceros pertenecen a sus respectivos titulares (vea Créditos de imágenes).' },
      ],
    },
    contactHeading: 'Contacto',
  },
};
