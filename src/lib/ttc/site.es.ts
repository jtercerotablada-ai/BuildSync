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
 *   • "y", never "&", inside Spanish text (the firm's name is written with "and", as in English: Tercero Tablada Civil and Structural Engineering Inc.).
 *   • "Inspección de hito (milestone)" on first mention, then "de hito".
 *   • The two county programs by their own names: "recertificación de
 *     edificios" (Miami-Dade) and "Programa de Inspección de Seguridad de
 *     Edificios (BSIP)" (Broward) on first mention, then "el BSIP". Never
 *     "recertificación" for Broward's program, except as the name people
 *     still give it.
 *   • "Recertificación de 40 años" is that name, for both programs: it is
 *     what people type, so it is in the two program titles, descriptions and
 *     first lines — always as a name ("antes", "todavía la llaman"), never
 *     as a rule in force.
 *   • Questions (`faq`) are written the way a board member asks them, in the
 *     first person plural ("¿Cuánto tiempo tenemos?"), not translated word
 *     for word; the answers address the reader as "usted".
 *   • "Con licencia", not "licenciado" (a degree title in Latin America);
 *     "la firma", not "la práctica"; "tramitar/obtener el permiso", never
 *     "permitir" (which means "to allow").
 *   • Avoid the "contra" calque of "checked against": "con base en",
 *     "según", "se compara con". Same for "bajo la ley" ("under the law"):
 *     "conforme a la ley".
 *   • What the firm sends is "una propuesta", never "un alcance": "scope" as
 *     a thing you receive is engineer's English. Where the extent of the
 *     work is meant, say whose — "el alcance del trabajo", "alcance de
 *     reparaciones" — or say it plainly ("qué incluye").
 *   • "Trabajos típicos" for "typical engagements", not "encargos".
 *     ("Encargo profesional" stays in the legal notice and the terms, where
 *     it is the legal word for an engagement.)
 *   • "Dueño" where the page speaks TO the reader ("Usted es dueño de un
 *     edificio…", the audience lines of the two county programs);
 *     "propietario" everywhere else, and always in the regulatory copy.
 *     Both are right; "dueño" is the one a building owner says.
 *   • "El edificio", not "el sitio", for a building that already stands
 *     ("la primera visita al edificio"); "en sitio" stays for "on site".
 *   • The complete package (the owner's decision of October 7, 2026 — see
 *     the header of site.ts): "el paquete completo", "un solo equipo". Its
 *     parts by the names a South Florida owner uses: "informe estructural",
 *     "informe eléctrico", "termografía infrarroja", "certificado de
 *     iluminación del estacionamiento", "certificado de barandas
 *     (guardrails) del estacionamiento" — with the official English name in
 *     parentheses the first time, where the letter the owner holds says it
 *     in English. "Barandas", not "barreras de protección", which an
 *     earlier line used for the same guardrails. Broward's package is NOT
 *     Miami-Dade's: no parking-lot certificate and no thermography rule is
 *     printed on the Broward page.
 */

import { ADS, ADS_COOKIE_DAYS } from './ads';
import { browardMunicipalities, miamiDadeMunicipalities } from './municipalities';
import { photo } from './media';
import type { SiteContent } from './site';

/**
 * The same date as `regulatoryChecked` in site.ts, in Spanish (month in
 * lowercase). It feeds `timing.checked` of the three regulated services.
 * Move both together, and only after re-reading the sources.
 */
export const regulatoryChecked = '4 de octubre de 2026';

/**
 * The same date as `officeLinksChecked` in site.ts, in Spanish: the day the
 * offices under "¿Quién le envió la notificación?" were last read on their
 * cities' own pages (and the links that leave the site last opened). Move
 * both together (site.test.ts compares them with the ISO date in site.ts).
 */
export const officeLinksChecked = '7 de octubre de 2026';

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
    title: 'Recertificación de edificios',
    shortTitle: 'Recertificación',
    track: 'existing',
    coverage: 'Condado de Miami-Dade, Florida',
    areaServed: ['Miami-Dade County, Florida'],
    summary:
      'Un solo equipo para la recertificación completa de Miami-Dade, desde la notificación hasta el informe enmendado que la cierra — el informe estructural, el informe eléctrico y los certificados que el condado pide con ellos.',
    /* The card's own lines on /es/services — see `card` in site.ts. */
    card: {
      when: 'La notificación ya llegó, un aviso de cortesía anuncia que viene, o una recertificación anterior sigue abierta.',
      receive: 'Todos los informes y certificados que pide Miami-Dade — estructural, eléctrico y, donde apliquen, la termografía y los certificados del estacionamiento — y el alcance de reparaciones donde haga falta.',
      next: 'Empiece por la notificación — sirve una foto tomada con el teléfono — o, si aún no la tiene, por la dirección y el año de construcción.',
    },
    /* The name most owners still use, first — as a name, with no number —
       then what the reader risks and the way out (2026-10-20; see the EN
       block): the county's own consequences, with no amount. Measure it on
       a phone like the English line before lengthening it. */
    heroSub:
      'Aún la llaman la recertificación de 40 años. Sin respuesta, la notificación puede traer multas y un gravamen. ¿Ya va tarde? Un solo equipo todavía la entrega completa.',
    /* The page's own h2s — same keys as the EN block; no age, no day count. */
    headings: {
      whatsIncluded: 'Qué incluye una recertificación completa en Miami-Dade',
      whenItApplies: 'Quién debe recertificar en Miami-Dade, y cuándo',
      howItRuns: 'Cómo se hace una recertificación, paso a paso',
      faq: 'Preguntas frecuentes sobre la recertificación en Miami-Dade',
      considerations: 'Informes de recertificación, formularios del condado y los límites de una inspección.',
    },
    problemTitle: 'Llega una notificación con un plazo.',
    /* One sentence on what a recertification is, and "un ingeniero
       estructural", once: the Spanish pages never said it in their body. */
    problem:
      'La recertificación de edificios es la inspección periódica de seguridad, estructural y eléctrica, que el Condado de Miami-Dade exige a los edificios antiguos, con un informe escrito para el Building Official (el funcionario de construcción). La Notificación de Inspección Requerida (Notice of Required Inspection) trae formularios y muy poca explicación de lo que realmente tiene que ocurrir. Las juntas directivas y los propietarios necesitan un ingeniero estructural cuyo equipo conozca la secuencia del condado y entregue la recertificación completa — el informe estructural, el informe eléctrico y los certificados que los acompañan — desde la primera visita al edificio hasta el informe que la cierra.',
    audience: [
      'Asociaciones de condominio, de cooperativa y de propietarios',
      'Administradores de propiedades',
      /* "Administradores de activos" was word for word "asset managers". */
      'Dueños de edificios y administradores de inversiones inmobiliarias',
    ],
    when: [
      'Llegó una Notificación de Inspección Requerida de su ciudad o del Condado de Miami-Dade — o un aviso de cortesía le anuncia que viene en camino.',
      /* "Cierra la recertificación", never a bare "cerrarse": that read as
         "the building must be shut down". */
      'Un informe anterior identificó reparaciones y la recertificación sigue abierta.',
      'Está comprando o administrando un edificio en Miami-Dade y quiere saber en qué punto del ciclo de recertificación se encuentra.',
    ],
    capabilities: ['Revisión de la notificación', 'Inspección estructural y eléctrica', 'Termografía, donde se requiera', 'Certificados del estacionamiento', 'Informes en los formularios del condado', 'Alcance de reparaciones', 'Reinspección'],
    scope: [
      'Revisión de la notificación de su ciudad o del condado, los registros del edificio y los informes previos',
      'Inspección estructural en sitio — estructura, losas, balcones, fachada, techo y cimentaciones',
      'Inspección eléctrica en sitio — la acometida, los cuartos de medidores y los cuartos eléctricos, los tableros, el cableado y la puesta a tierra, la iluminación de emergencia, los letreros de salida y la alarma contra incendios',
      'Termografía infrarroja de los equipos eléctricos, donde el servicio eléctrico del edificio la requiera',
      'Medición de los niveles de iluminación del estacionamiento que sirve al edificio, e inspección del estacionamiento para el certificado de barandas (guardrails) del condado',
      'Clasificación de las condiciones observadas según su importancia estructural, para el informe de recertificación',
      'Alcance de reparaciones que indica qué debe corregirse, para que los contratistas coticen el mismo trabajo',
      'Reinspección de las reparaciones terminadas',
      'Respuesta a las preguntas de la oficina revisora sobre los informes',
    ],
    /* The county's order — see the EN block. Same six labels as Broward's. */
    process: [
      { step: 'Revisión de la notificación', detail: 'Leemos la notificación y el historial del edificio, y confirmamos qué está pidiendo el Building Official y para cuándo.' },
      { step: 'Inspección', detail: 'Inspección estructural y eléctrica en sitio — la estructura, las losas, los balcones, la fachada, el techo y las cimentaciones expuestas, y los sistemas eléctricos del edificio — documentada con fotografías vinculadas a su ubicación. La termografía y las mediciones del estacionamiento se hacen donde aplican.' },
      { step: 'Informe presentado', detail: 'Los informes estructural y eléctrico se preparan en los formularios del propio condado, firmados y sellados, con los certificados y anexos que su edificio necesite, y se presentan aunque enumeren reparaciones. El condado pide los informes primero, no después de la obra.' },
      { step: 'Reparaciones con permiso', detail: 'Donde se requieran reparaciones, definimos qué debe corregirse para que los contratistas coticen el mismo trabajo. Las reparaciones que requieren permiso esperan a tenerlo y luego siguen su calendario.' },
      { step: 'Reinspección', detail: 'Las reparaciones terminadas se reinspeccionan, se documentan y se comparan con los hallazgos originales.' },
      { step: 'Cierre', detail: 'Un informe enmendado indica que las reparaciones están completas. Eso es lo que cierra la recertificación, hasta el siguiente ciclo.' },
    ],
    /* The whole package, named once; its parts are `packet`, printed right
       under this list — see the EN block. */
    deliverables: [
      'El paquete completo de recertificación de su edificio: los informes estructural y eléctrico en los formularios del propio condado, cada uno firmado y sellado, con los certificados y anexos que se detallan abajo',
      'Alcance de reparaciones por escrito, cuando los informes las enumeren',
      'Carta sobre si el edificio puede seguir ocupado durante las reparaciones, cuando se requiera',
      'Informe enmendado tras las reparaciones',
    ],
    nextStep:
      'Envíe la notificación — basta una foto tomada con el teléfono — o la dirección y el año de construcción. Confirmamos qué le está pidiendo el Building Official (el funcionario de construcción) y respondemos con una propuesta para la recertificación completa: todos los informes y certificados que su edificio necesite.',
    timing: {
      checked: regulatoryChecked,
      /* Corrected with the EN note: the county report SERVES AS the state
         milestone inspection; it is not a separate obligation. The board's
         duties are `duties`, three lines instead of one long sentence. They
         name the two documents the statute counts from as this page names
         them — the notice from the city or the county, the recertification
         report — and nothing else about them may change (see the EN note). */
      note: 'La notificación la envía el Building Official de su ciudad, o el condado en las áreas no incorporadas, y el informe se presenta ante esa misma oficina. En edificios de condominio y cooperativa de tres pisos habitables o más, el informe de recertificación sirve como la inspección de hito (milestone) del estado, y los deberes de la junta directiva con los propietarios de las unidades conforme a la ley estatal (Florida Statute 553.899) se mantienen.',
      duties: [
        'Dentro de los 14 días de recibir la notificación de su ciudad o del condado, avisar a los propietarios de las unidades de la inspección requerida y de la fecha en que debe quedar completada.',
        'Dentro de los 45 días de recibir el informe de recertificación, enviar a cada propietario el resumen del ingeniero y colocarlo en un lugar visible de la propiedad.',
        'En esos mismos 45 días, publicar el informe de recertificación y el resumen en el sitio web de la asociación, cuando la asociación esté obligada a tener uno.',
      ],
      rows: [
        {
          jurisdiction: 'Condado de Miami-Dade',
          source: 'Código del Condado de Miami-Dade, Sección 8-11(f)',
          /* Same link as the EN row; the code is published in English. */
          sourceUrl:
            'https://library.municode.com/fl/miami_-_dade_county/codes/code_of_ordinances?nodeId=PTIIICOOR_CH8BUCO_ARTIAD_S8-11EXBU',
          /* Same six labels, same order, as the Broward row. Numbers are
             identical to the EN row — amend both or neither. */
          facts: [
            { k: 'Aplica a', scope: true, v: 'Casi todos los tipos de edificio — condominios, cooperativas, apartamentos, oficinas, comercios e industrias. Fuera del programa: viviendas unifamiliares, dúplex y edificios que tengan a la vez una carga de ocupantes de 10 o menos según el Código de Construcción de Florida y un área bruta de 2,000 pies cuadrados o menos.' },
            { k: 'Primer vencimiento', v: 'A los 30 años — 25 para edificios de condominio y cooperativa de tres pisos o más a 3 millas o menos de la costa. La edad se cuenta desde el año de construcción que figura en el registro del Property Appraiser (el tasador de propiedades del condado).', home: true },
            { k: 'Después', v: 'Cada 10 años, durante la vida de la estructura.', home: true },
            { k: 'Plazo para presentar', v: '90 días desde la Notificación de Inspección Requerida (Notice of Required Inspection). Los avisos de cortesía deberían llegar dos años y un año antes; no recibirlos no mueve el plazo.', filing: true, home: true },
            { k: 'Si hay reparaciones', v: '150 días desde la notificación para terminar las reparaciones que no requieren permiso y obtener los permisos de las demás. La obra con permiso sigue luego el calendario de su permiso, y un informe enmendado cierra la recertificación.', home: true },
            { k: 'Condominios y cooperativas', v: 'La recertificación sirve como cumplimiento de la inspección de hito (milestone) del estado — no se presenta un informe de hito aparte.', home: true },
          ],
        },
      ],
    },
    /* PREGUNTAS FRECUENTES — mirror of the EN `faq`, question for question,
       and under the same rules (read the comment there): no age, day count
       or deadline typed in an answer — it points at the row above by its
       label in curly quotes —, "40 años" only as the name people still use,
       no amounts, no promise about what an office will do. The sentences
       that came from "Conviene saber" are the ones that were already there.
       "Multas" for the county's "penalties": the plain word, with no
       amount. Each question names the recertification, as in English: none
       is worded like the Broward page's (programs.test.ts). */
    faq: [
      {
        q: '¿Es esta la recertificación de 40 años?',
        a: 'Sí. “Recertificación de 40 años” es el nombre que muchos propietarios todavía le dan a la recertificación de edificios de Miami-Dade, de la época en que la primera inspección vencía a esa edad. El programa es el mismo; la primera inspección ahora vence antes, a las edades indicadas en “Primer vencimiento”, en la tabla de arriba.',
      },
      {
        q: 'Nos llegó la notificación de recertificación de Miami-Dade. ¿Qué hacemos primero?',
        a: 'Envíenosla — basta una foto de la carta tomada con el teléfono. Leemos la notificación y el historial del edificio, confirmamos qué está pidiendo el Building Official (el funcionario de construcción) y para cuándo, y respondemos con una propuesta para la recertificación completa, no solo para su informe estructural. En un condominio o una cooperativa de tres pisos habitables o más, la junta directiva tiene además deberes con los propietarios de las unidades: vea “Qué debe hacer la junta directiva”, arriba.',
      },
      {
        /* The owner's answer of October 7, 2026, as a board asks it — see
           the EN block. It took the place of "¿Ante quién se presenta el
           informe de recertificación?", which the note beside the table and
           "¿Quién le envió la notificación?" both answer. The official
           English name of the guardrail certificate is in parentheses:
           that is the word on the county's form. */
        q: '¿La recertificación de Miami-Dade incluye el informe eléctrico, la termografía y los certificados del estacionamiento?',
        a: 'Sí. El condado pide más que un informe estructural: también un informe eléctrico, una inspección de termografía infrarroja donde el servicio eléctrico del edificio la requiera, y sus dos certificados del estacionamiento, el de iluminación y el de barandas (guardrails), donde apliquen. Un solo equipo entrega todo, así que la junta directiva hace una sola llamada. Cada parte, y cuándo aplica, está en la lista del paquete, más arriba.',
      },
      {
        q: '¿Cuánto tiempo tenemos para recertificar en Miami-Dade?',
        a: 'La fila “Plazo para presentar” de la tabla de arriba indica el plazo para el informe, y “Si hay reparaciones”, el de lo que sigue; ambos se cuentan desde la Notificación de Inspección Requerida. Envíenos primero la carta: con ella confirmamos qué está pidiendo el Building Official y para cuándo.',
      },
      {
        q: '¿Nuestro edificio tiene que recertificarse? ¿Cuáles están exentos?',
        a: 'Casi todos los edificios tienen que hacerlo. La fila “Aplica a” de la tabla de arriba enumera los tipos de edificio y los pocos que quedan fuera del programa, y “Primer vencimiento” indica la edad a la que vence la primera recertificación, contada desde el año de construcción que figura en el registro del Property Appraiser (el tasador de propiedades del condado).',
      },
      {
        q: 'Nunca recibimos una notificación de recertificación. ¿Estamos exentos?',
        a: 'No. Un edificio entra en el programa por su tipo y por su edad — las filas “Aplica a” y “Primer vencimiento” de arriba —, no porque haya llegado una carta. Los avisos de cortesía deberían llegar con antelación, y no recibirlos no mueve el plazo. ¿Aún no tiene notificación? Envíe la dirección y el año de construcción.',
      },
      {
        /* The length of a prórroga stays in the one sentence that states
           it, under "Conviene saber" — see the EN block. */
        q: '¿Podemos pedir una prórroga para la recertificación?',
        a: 'Se puede solicitar, para presentar el informe o para obtener los permisos, y quien la concede es el Building Official. La solicitud la presenta el ingeniero, firmada y sellada, y en ella declara que el edificio puede seguir ocupado. Cuánto puede durar una prórroga está en “Conviene saber”, más abajo en esta página.',
      },
      {
        q: '¿La recertificación obliga a llevar el edificio al código actual?',
        a: 'No. El edificio se evalúa según el código vigente cuando se construyó. La recertificación no exige llevarlo al código actual.',
      },
      {
        q: '¿La recertificación es lo mismo que la inspección de hito (milestone) del estado?',
        a: 'En edificios de condominio y cooperativa de tres pisos habitables o más, el informe de recertificación sirve como la inspección de hito (milestone) del estado, y no se presenta un informe de hito aparte. Lo que la ley estatal añade para esos edificios son los deberes de la junta directiva con los propietarios de las unidades, que aparecen en “Qué debe hacer la junta directiva”, arriba. Los demás edificios quedan fuera de la ley de inspecciones de hito y responden solo al programa del condado.',
      },
      {
        q: '¿Qué pasa si el informe de recertificación enumera reparaciones?',
        a: 'El informe se presenta igual: el condado lo pide primero, no después de la obra. Donde se requieran reparaciones, definimos qué debe corregirse para que los contratistas coticen el mismo trabajo; las que requieren permiso esperan a tenerlo, y un informe enmendado que indica que las reparaciones están completas cierra la recertificación. El plazo está en la fila “Si hay reparaciones” de la tabla de arriba.',
      },
      {
        q: '¿Qué pasa si no recertificamos a tiempo?',
        a: 'La página de recertificación del Condado de Miami-Dade indica que, cuando la recertificación no se obtiene a tiempo, se emite una citación sin más aviso y el caso pasa a la división del condado que hace cumplir el código; después pueden acumularse multas, y puede seguir un gravamen (lien). Cada ciudad maneja sus propios casos, así que los pasos y los montos los fija la oficina que envió su notificación. ¿Ya pasó la fecha de su notificación? Envíe la notificación y cualquier citación; el primer paso es hacer la inspección y presentar el informe.',
      },
      {
        q: 'Nuestro edificio es antiguo y nunca se recertificó. ¿Estamos atrasados?',
        a: 'Es posible. Cuando el condado acortó el calendario, fijó una sola fecha para que se pusieran al día los edificios que ya habían pasado las nuevas edades, y esa fecha ya pasó; los edificios que ya se habían recertificado con el calendario anterior conservan el que tenían. Envíe la dirección y el año de construcción, y confirmamos qué aplica a su edificio antes de presentar una propuesta.',
      },
    ],
    /* What is left under "Conviene saber" once the questions took their
       share — see the EN block. The sentences are unchanged, but for the
       last two: each names this page's own Building Official and report,
       where it used to be word for word the Broward page's. */
    considerations: [
      /* Threshold buildings: neutral on purpose, claims no credential. */
      'Los edificios de más de tres pisos o 50 pies se consideran “threshold buildings” (edificios de umbral), y su informe estructural debe prepararlo un ingeniero con las calificaciones adicionales que exige el Condado de Miami-Dade. Lo confirmamos para su edificio antes de presentar una propuesta.',
      'Para los informes estructural y eléctrico solo se aceptan los formularios del propio condado — no el formulario de una firma —, y cada edificio de una propiedad lleva sus propios informes.',
      /* What the two parking-lot forms ARE: a measurement and a finding.
         Never "certificamos que el estacionamiento cumple". */
      'Los certificados del estacionamiento no prometen que un estacionamiento cumpla; dejan constancia de lo que se midió y se encontró: si los niveles de iluminación alcanzan o no el estándar del condado, y si un estacionamiento junto al agua tiene la baranda que el condado exige. Donde falte la baranda, el propietario necesita un permiso para instalarla.',
      /* "Completo" is the package, never the outcome — see the EN header. */
      'Un paquete completo todavía no es una recertificación cerrada. Donde los informes enumeren reparaciones, primero se hacen — con permiso donde haga falta — y el informe enmendado es lo que la cierra.',
      'El Building Official puede conceder una prórroga de hasta 60 días para presentar el informe o para obtener los permisos, a solicitud firmada y sellada del ingeniero en la que declare que el edificio puede seguir ocupado.',
      'El informe enmendado que cierra una recertificación lo emite el ingeniero o arquitecto que presentó el informe original. Si el suyo lo presentó otra firma, indíquelo al escribirnos — confirmamos qué hará falta para cerrarla antes de presentar una propuesta.',
      'Una condición que ponga en peligro la vida o la propiedad se informa al propietario y al Building Official de su ciudad, o del condado en las áreas no incorporadas; el ingeniero tiene el deber de hacerlo.',
      'Un informe de recertificación documenta condiciones observadas; las ocultas pueden requerir investigación adicional, y ningún ingeniero puede garantizar cómo actuará una oficina revisora a partir de él.',
    ],
    notesToggle: 'Las {n} notas',
    /* ¿QUIÉN LE ENVIÓ LA NOTIFICACIÓN? — mirror of the EN `offices`: the same
       rows, in the same order, as TEXT (they were links until 2026-10-07;
       the reasoning is in site.ts, and the cities' addresses are in
       `office-pages.ts` and not here). Specific to the Spanish:
         • The office names stay in English: they are the offices' own
           names. The lede says so, because a row is otherwise the one
           English line in a Spanish page.
         • `forms` is the one link left, and the page it opens is in
           English: `forms.text` says that, where the lede used to say it
           of every row's page.
         • "Municipio" for the county's "municipality"; "las áreas no
           incorporadas", as in the timing note above. */
    offices: {
      title: '¿Quién le envió la notificación?',
      lede: 'La notificación la envía la oficina de construcción de su propia ciudad, o el condado en las áreas no incorporadas, y el informe se presenta ante esa misma oficina. Busque la suya abajo: cada oficina aparece con su propio nombre, en inglés.',
      rows: [
        { city: 'Ciudad de Miami', office: 'City of Miami Building Department, Unsafe Structures Section' },
        { city: 'Miami Beach', office: 'City of Miami Beach Building Department' },
        { city: 'Hialeah', office: 'City of Hialeah Building Division' },
        { city: 'Coral Gables', office: 'City of Coral Gables Building Division' },
        { city: 'Doral', office: 'City of Doral Building Department' },
        { city: 'North Miami', office: 'City of North Miami Building Department' },
        { city: 'North Miami Beach', office: 'City of North Miami Beach Building Department' },
        { city: 'Aventura', office: 'City of Aventura Building Division' },
        { city: 'Sunny Isles Beach', office: 'City of Sunny Isles Beach Building Department' },
        { city: 'Miami Gardens', office: 'City of Miami Gardens Building Services' },
        { city: 'Homestead', office: 'City of Homestead Development Services, Building Safety' },
        { city: 'Surfside', office: 'Town of Surfside Building Department' },
        { city: 'Key Biscayne', office: 'Village of Key Biscayne Building, Zoning and Planning Department' },
        { city: 'Bay Harbor Islands', office: 'Town of Bay Harbor Islands Building Department' },
        { city: 'Cutler Bay', office: 'Town of Cutler Bay Building Division' },
        { city: 'El Portal', office: 'Village of El Portal Building Department' },
        { city: 'Florida City', office: 'City of Florida City Building Department' },
        { city: 'Medley', office: 'Town of Medley Building Department' },
        { city: 'Miami Lakes', office: 'Town of Miami Lakes Building Department' },
        { city: 'Miami Springs', office: 'City of Miami Springs Building Department' },
        { city: 'North Bay Village', office: 'North Bay Village Building and Zoning Department' },
        { city: 'Opa-locka', office: 'City of Opa-locka Building and Licensing Department' },
        { city: 'Pinecrest', office: 'Village of Pinecrest Building Department' },
        { city: 'Sweetwater', office: 'City of Sweetwater Building and Zoning Department' },
        { city: 'West Miami', office: 'City of West Miami Building Department' },
        { city: 'Áreas no incorporadas de Miami-Dade', office: 'Miami-Dade County Regulatory and Economic Resources' },
      ],
      note: '¿Su ciudad no está en la lista? Cada municipio de Miami-Dade maneja sus propias recertificaciones, y la carta indica la oficina que la envió. Las preguntas sobre una notificación se dirigen a esa oficina. Envíenos la carta: la leemos antes de presentar una propuesta.',
      forms: {
        text: 'Estos son los formularios en los que se presenta el informe (página oficial, en inglés):',
        label: 'Condado de Miami-Dade: guías y plantillas de informe de la recertificación',
        url: 'https://www.miamidade.gov/global/economy/building/recertification.page',
      },
      checked: officeLinksChecked,
      toggle: '{n} oficinas de construcción, ciudad por ciudad',
    },
    /* EL PAQUETE DE MIAMI-DADE — mirror of the EN `packet`: the same eight
       rows in the same order, and the same care in each (read the comment
       there before touching one). Specific to the Spanish: the county's
       own name for a part is in parentheses where the owner will meet it in
       English — on the form, or as the name of the file. */
    packet: {
      label: 'El paquete de Miami-Dade, parte por parte',
      lede: 'Lo que el condado pide con una recertificación, y lo que nuestro equipo entrega para su edificio. Algunas partes se presentan para todos los edificios; otras, solo donde se cumple la condición que las acompaña — y una ciudad puede pedir un conjunto distinto del que pide el condado.',
      parts: [
        { k: 'Informe estructural', v: 'La condición estructural del edificio — cimentaciones, estructura, losas, balcones, fachada y techo — en el formulario estructural del condado (Structural Report). Lo presentan todos los edificios del programa.' },
        { k: 'Informe eléctrico', v: 'La condición general de los sistemas eléctricos del edificio, en el formulario eléctrico del condado (Electrical Report). Lo presentan todos los edificios del programa, como un archivo aparte.' },
        { k: 'Termografía infrarroja', v: 'Una inspección infrarroja de los equipos eléctricos (infrared thermography), con un informe escrito que se adjunta al informe eléctrico. Aplica donde el servicio eléctrico del edificio la requiera, y nunca a los tableros que están dentro de las unidades.' },
        { k: 'Certificado de iluminación del estacionamiento', v: 'Los niveles de iluminación medidos en el estacionamiento que sirve al edificio (Parking Lot Illumination), y si alcanzan el estándar del condado para ese tipo de edificio. Se presenta con el paquete donde aplique.' },
        { k: 'Certificado de barandas (guardrails) del estacionamiento', v: 'El formulario del condado sobre si el estacionamiento colinda con un canal, un lago u otro cuerpo de agua y, de ser así, si los vehículos estacionados están protegidos por la baranda que el condado exige.' },
        { k: 'Carta de presentación', v: 'Una carta (cover letter) que acompaña a cada informe e indica su conclusión sobre si el edificio puede seguir ocupado.' },
        { k: 'Fotografías', v: 'Las fotografías que piden los formularios del condado: las de las condiciones que describe cada informe y las de cada fachada del edificio.' },
        { k: 'Plano del sitio o levantamiento topográfico', v: 'Una vista aérea que identifica el edificio acompaña a todo informe estructural. Donde una propiedad tiene más de un edificio, un plano del sitio (site plan) o la copia de un levantamiento (survey) muestra a cuál corresponden los informes.' },
      ],
      note: 'Leemos primero la carta de su ciudad y proponemos el paquete que esa carta pide.',
      toggle: 'Las {n} partes del paquete',
    },
    alsoCalled: ['Recertificación de 40 años', 'Recertificación de edificios'],
    crossLink: { text: '¿Su edificio está en Broward?', label: 'Vea el BSIP', slug: 'broward-bsip' },
    program: {
      id: 'miami-dade',
      county: 'Miami-Dade',
      eyebrow: 'Condado de Miami-Dade · Recertificación de edificios',
      /* "90 días" must always equal the row's "Plazo para presentar". */
      titleLines: ['Recertificación en Miami-Dade.', '90 días desde la notificación.'],
      accentWord: '90 días',
      lede: 'Una notificación sin respuesta no desaparece: se convierte en multas que pueden llegar a $10,000 por infracción, un gravamen sobre su propiedad y, en el peor caso, una orden de desalojo. ¿Ya va tarde? Todavía tiene solución — envíenos la carta hoy; la propuesta es gratis.',
      steps: ['Revisión de la notificación', 'Inspección', 'Informe presentado', 'Reparaciones y cierre'],
      cta: 'Enviar la notificación de Miami-Dade',
      timingLink: 'Plazos y exenciones de Miami-Dade',
      detail: 'La recertificación en detalle',
    },
    /* No ages and no day counts — see the EN block. "De 40 años" is in the
       title and the description as the name the program used to have
       ("antes", "aún llaman"), never as a rule: it is what people type, and
       it used to sit in the keywords only; do not move the name back. The
       title ends there, as in English: with "— Ingeniero estructural" after
       it, it was 771 px of the 580 a search result shows (seo.ts). */
    seo: {
      title: 'Recertificación de edificios en Miami-Dade, antes “de 40 años”',
      /* It used to end "un P.E. de Florida inspecciona y presenta el
         informe": one person, one report. It now names the complete
         package — see the EN block. The English terms in the keywords are
         the ones on the county's forms. */
      description:
        'Recertificación completa en Miami-Dade, aún llamada “de 40 años”: informes estructural y eléctrico, certificados del estacionamiento y termografía si aplica.',
      keywords: ['recertificación de edificios Miami-Dade', 'ingeniero recertificación Miami-Dade', 'recertificación 40 años Miami', 'recertificación 30 años Miami', 'recertificación de condominios Miami', 'informe de recertificación estructural', 'recertificación eléctrica Miami-Dade', 'termografía infrarroja Miami', 'certificado de iluminación del estacionamiento', 'certificado de barandas del estacionamiento', 'parking lot illumination certification', 'parking lot guardrail certification'],
    },
  },
  {
    slug: 'broward-bsip',
    n: '02',
    title: 'Programa de Inspección de Seguridad de Edificios (BSIP)',
    shortTitle: 'BSIP',
    track: 'existing',
    coverage: 'Condado de Broward, Florida',
    areaServed: ['Broward County, Florida'],
    summary:
      'Un solo equipo para el paquete completo del BSIP, desde la Notificación de Inspección Requerida hasta la carta de finalización que cierra el expediente — las inspecciones estructural y eléctrica, el informe escrito y los dos formularios oficiales del programa.',
    card: {
      when: 'La carta certificada ya llegó, el edificio se acerca a su primera inspección, o un expediente anterior sigue abierto.',
      receive: 'El paquete completo — el informe escrito, los formularios estructural y eléctrico del programa y las fotografías a color — y el alcance de reparaciones donde haga falta.',
      next: 'Empiece por la carta de su ciudad — sirve una foto tomada con el teléfono — o, si aún no la tiene, por la dirección y el año del certificado de ocupación.',
    },
    /* The name owners still use, as a name, then what the reader risks and
       the way out (2026-10-20): the Board's policy (#05-05), with no
       amount. See the EN block, and its note on length. "Todavía", as the
       EN "still" and the Miami-Dade line: the answer to "¿Pasó la fecha?"
       says it can still be done; "de Broward" left out to fit, the H1 right
       above names the county. */
    heroSub:
      'Muchos aún llaman al BSIP la recertificación de 40 años. Un informe tardío va a audiencia de cumplimiento. ¿Pasó la fecha? Un solo equipo todavía lo entrega completo.',
    /* The page's own h2s — same keys as the EN block; no age, no day count. */
    headings: {
      whatsIncluded: 'Qué cubre una inspección completa del BSIP de Broward',
      whenItApplies: 'A qué edificios alcanza el BSIP de Broward',
      howItRuns: 'De la notificación al informe presentado',
      faq: 'Preguntas frecuentes sobre el BSIP de Broward',
      considerations: 'Informes del BSIP, formularios oficiales y los límites de una inspección.',
    },
    problemTitle: 'Una carta certificada con un plazo.',
    /* "40 años" here, under the H1, in the first question and in the title:
       always as the name people still use, never as a trigger. The English
       program name appears once, because it is what the letter says. "Un
       ingeniero estructural", once — see the Miami-Dade block. */
    problem:
      'El Programa de Inspección de Seguridad de Edificios (BSIP, por Building Safety Inspection Program) de Broward exige una inspección de seguridad, estructural y eléctrica, de los edificios antiguos de todo el condado. Lo redacta la Junta de Reglas y Apelaciones del Condado de Broward (Board of Rules and Appeals) y lo hace cumplir el Building Official (el funcionario de construcción) de su ciudad. Muchos propietarios todavía lo llaman la recertificación de 40 años, y buena parte de lo que se ha escrito sobre él describe reglas que ya cambiaron. Las juntas directivas y los propietarios necesitan un ingeniero estructural cuyo equipo trabaje con la política vigente y entregue las dos mitades del programa, la inspección estructural y la eléctrica, desde la primera visita al edificio hasta el cierre.',
    audience: [
      'Asociaciones de condominio, de cooperativa y de propietarios',
      'Administradores de propiedades',
      'Dueños de edificios de alquiler, comerciales y de uso mixto',
    ],
    when: [
      'Llegó una Notificación de Inspección Requerida de su ciudad — o el edificio se acerca a la edad en la que llegará.',
      'Un informe anterior identificó reparaciones y el expediente sigue abierto.',
      'Está comprando o administrando un edificio en Broward y quiere saber en qué punto del ciclo de inspección se encuentra.',
    ],
    capabilities: ['Revisión de la notificación', 'Inspección estructural y eléctrica', 'Informe escrito y los dos formularios oficiales', 'Alcance de reparaciones', 'Reinspección y cierre'],
    scope: [
      'Revisión de la carta de su ciudad, los registros del edificio y los informes previos',
      'Inspección estructural en sitio — estructura, losas, balcones, escaleras, barandas, techo y cimentaciones, y el garaje de estacionamiento donde lo haya',
      'Inspección eléctrica en sitio — la acometida y sus equipos, los cuartos eléctricos, el cableado y la puesta a tierra, la iluminación de emergencia, la alarma contra incendios y las luces de salida, y el cableado de estacionamientos y garajes',
      'Condiciones observadas, clasificadas según su importancia estructural, para el informe del BSIP',
      'Trabajo de reparación definido para que los contratistas coticen lo mismo',
      'Reinspección de las áreas reparadas',
      'Respuesta a las preguntas del Building Official sobre el informe y sus formularios',
    ],
    /* Same six labels as the Miami-Dade page; Broward's own content. */
    process: [
      { step: 'Revisión de la notificación', detail: 'Leemos primero la carta de su ciudad: la fecha en que se recibió, la fecha que fija y lo que el Building Official pide que se presente.' },
      { step: 'Inspección', detail: 'Un examen visual sistemático de la estructura y de los sistemas eléctricos en sitio, con ensayos o aperturas de acabados solo donde lo que vemos lo justifica.' },
      { step: 'Informe presentado', detail: 'Un informe narrativo escrito con fotografías a color, más los formularios oficiales, estructural y eléctrico, de la Junta de Reglas y Apelaciones, firmados y sellados. Se presenta en cuanto está completo, aunque enumere reparaciones.' },
      { step: 'Reparaciones con permiso', detail: 'Donde se requieran reparaciones, definimos el trabajo para que los contratistas coticen lo mismo, y emitimos la carta firmada y sellada sobre si el edificio puede seguir ocupado mientras tanto. Las reparaciones esperan a tener sus permisos.' },
      { step: 'Reinspección', detail: 'Terminada la obra, se reinspeccionan las áreas señaladas en el informe original.' },
      { step: 'Cierre', detail: 'Un informe enmendado y una carta de finalización firmada y sellada se entregan al propietario y al Building Official. Eso cierra el expediente, hasta el siguiente ciclo.' },
    ],
    /* The whole package, named once; its parts are `packet` — see the EN
       block. */
    deliverables: [
      'El paquete completo del BSIP: un informe narrativo escrito y los formularios estructural y eléctrico de la Junta de Reglas y Apelaciones, cada uno firmado y sellado, con fotografías a color, detallados parte por parte abajo',
      'Alcance de reparaciones por escrito, cuando se requieran',
      'Carta firmada y sellada sobre si el edificio puede seguir ocupado durante las reparaciones',
      'Informe enmendado y carta de finalización tras las reparaciones',
    ],
    nextStep:
      'Envíe la notificación — basta una foto tomada con el teléfono — o la dirección y el año del certificado de ocupación. Leemos lo que pide su ciudad y respondemos con una propuesta para la inspección y el informe completos del BSIP, en lo estructural y en lo eléctrico.',
    timing: {
      checked: regulatoryChecked,
      /* The sentence about the city's letter moved to the front, and the
         board's duties to `duties` — see the EN block. The duties name the
         notice as the Building Official's and the report as the BSIP report,
         and are otherwise the Miami-Dade page's: the statute's, word for
         word in what they ask. */
      note: 'El Building Official de su ciudad hace cumplir el programa, y la carta de su ciudad indica su propia fecha — por eso la leemos primero. En edificios de condominio y cooperativa de tres pisos habitables o más, el informe del BSIP sirve como fase uno y fase dos de la inspección de hito (milestone) del estado, y los deberes de la junta directiva con los propietarios de las unidades conforme a la ley estatal (Florida Statute 553.899) se mantienen.',
      duties: [
        'Dentro de los 14 días de recibir la notificación del Building Official, avisar a los propietarios de las unidades de la inspección requerida y de la fecha en que debe quedar completada.',
        'Dentro de los 45 días de recibir el informe del BSIP, enviar a cada propietario el resumen del ingeniero y colocarlo en un lugar visible de la propiedad.',
        'En esos mismos 45 días, publicar el informe del BSIP y el resumen en el sitio web de la asociación, cuando la asociación esté obligada a tener uno.',
      ],
      rows: [
        {
          jurisdiction: 'Condado de Broward',
          source: 'Junta de Reglas y Apelaciones del Condado de Broward, Política n.º 05-05 · Código de Construcción de Florida, Enmiendas del Condado de Broward, Sección 110.15',
          /* Same link as the EN row: the Board's own page, which lists both
             texts. */
          sourceUrl: 'https://www.broward.org/codeappeals/FormsandContacts',
          /* Same six labels, same order, as the Miami-Dade row. "Plazo para
             presentar" keeps BOTH hedges of the EN row (older guides say 90;
             the city's letter states its own date) — neither may be cut. The
             180 days run from RECEIVING the notice: "desde que se recibe". */
          facts: [
            { k: 'Aplica a', scope: true, v: 'Casi todos los tipos de edificio, en todas las ciudades de Broward y en el área no incorporada. Fuera del programa: viviendas de una a cuatro familias de tres pisos habitables o menos, townhouses en dominio pleno (fee simple) y estructuras menores con un área de edificio inferior a 3,500 pies cuadrados.' },
            { k: 'Primer vencimiento', v: 'A los 25 años, contados desde el certificado de ocupación.', home: true },
            { k: 'Después', v: 'Cada 10 años.', home: true },
            { k: 'Plazo para presentar', v: '180 días desde que se recibe la Notificación de Inspección Requerida (Notice of Required Inspection). Las guías antiguas todavía dicen 90 días; la política vigente desde el 9 de agosto de 2024 da 180. La carta de su ciudad indica su propia fecha.', filing: true, home: true, homeWhole: true },
            { k: 'Si hay reparaciones', v: '180 días desde la fecha del informe, con permiso, salvo que el Building Official (el funcionario de construcción) de su ciudad fije otro plazo. Una reinspección, un informe enmendado y una carta de finalización firmada y sellada cierran el expediente.', home: true },
            { k: 'Condominios y cooperativas', v: 'El informe del BSIP sirve como fase uno y fase dos de la inspección de hito (milestone) del estado.', home: true },
          ],
        },
      ],
    },
    /* PREGUNTAS FRECUENTES — mirror of the EN `faq`, question for question,
       under the same rules (read the comment there and on the Miami-Dade
       block). "Sanciones" for the policy's "penalties", with no amount. The
       last answer never says which year the interval is counted from, and
       never computes one. */
    faq: [
      {
        q: '¿El BSIP es lo mismo que la recertificación de 40 años?',
        a: 'Sí. “Recertificación de 40 años” es el nombre que muchos propietarios todavía le dan al Programa de Inspección de Seguridad de Edificios (BSIP) de Broward, por la versión anterior del programa. Buena parte de lo que se ha escrito sobre él describe reglas que ya cambiaron; las edades y los plazos vigentes están en la tabla de arriba.',
      },
      {
        q: 'Nos llegó la notificación del BSIP de Broward. ¿Qué hacemos primero?',
        a: 'Envíenosla — basta una foto de la carta tomada con el teléfono. Leemos primero la carta de su ciudad: la fecha en que se recibió, la fecha que fija y lo que el Building Official (el funcionario de construcción) pide que se presente; luego respondemos con una propuesta para la inspección y el informe completos, en lo estructural y en lo eléctrico. En un condominio o una cooperativa de tres pisos habitables o más, la junta directiva tiene además deberes con los propietarios de las unidades: vea “Qué debe hacer la junta directiva”, arriba.',
      },
      {
        /* Broward's form of the owner's answer — see the EN block. It took
           the place of "¿Ante quién se presenta el informe del BSIP?".
           Broward's parts only: two inspections, one report, the Board's
           two forms, color photographs. */
        q: '¿El BSIP de Broward incluye una inspección eléctrica?',
        a: 'Sí. El programa pide dos inspecciones, la estructural y la eléctrica, y las dos se presentan en un solo informe escrito, con el formulario estructural y el formulario eléctrico de la Junta de Reglas y Apelaciones y con fotografías a color. Un solo equipo entrega todo, así que la junta directiva hace una sola llamada. Cada parte está en la lista del paquete, más arriba.',
      },
      {
        q: '¿Cuánto tiempo tenemos para presentar el informe del BSIP?',
        a: 'La fila “Plazo para presentar” de la tabla de arriba indica el plazo para el informe, contado desde el día en que se recibe la notificación, y “Si hay reparaciones”, el de la obra que sigue. La carta de su ciudad indica su propia fecha, y esa es la fecha con la que trabajamos.',
      },
      {
        q: '¿Nuestro edificio tiene que cumplir con el BSIP? ¿Cuáles están exentos?',
        a: 'Casi todos los tipos de edificio tienen que hacerlo, en todas las ciudades de Broward y en el área no incorporada. La fila “Aplica a” de la tabla de arriba enumera las viviendas y las estructuras menores que quedan fuera del programa, y “Primer vencimiento” indica la edad a la que vence la primera inspección. También quedan fuera del programa los edificios federales y del Estado de Florida, los edificios en tierras tribales soberanas, las escuelas de la Junta Escolar del Condado de Broward y los ferrocarriles.',
      },
      {
        q: 'Nunca recibimos una notificación del BSIP. ¿Estamos exentos?',
        a: 'No. La Junta de Reglas y Apelaciones envía a cada ciudad su lista de edificios a más tardar en junio, y el Building Official envía las notificaciones por correo certificado de junio a agosto. No recibir la notificación no es excusa: la inspección, el informe y las reparaciones que correspondan se deben igual, y a tiempo.',
      },
      {
        /* The length of a prórroga stays in the one sentence that states
           it, under "Conviene saber" — see the EN block. */
        q: '¿Podemos pedir una prórroga para el informe del BSIP?',
        a: 'Se puede solicitar para presentar el informe, y quien la concede es el Building Official. Pídala antes de la fecha que indica la carta de su ciudad. Cuánto puede durar una prórroga está en “Conviene saber”, más abajo en esta página.',
      },
      {
        q: '¿El BSIP obliga a llevar el edificio al código actual?',
        a: 'No. El edificio se evalúa según el código vigente cuando se construyó. El programa no exige llevarlo al código actual.',
      },
      {
        q: '¿El BSIP es lo mismo que la inspección de hito (milestone) del estado?',
        a: 'En edificios de condominio y cooperativa de tres pisos habitables o más, el informe del BSIP sirve como fase uno y fase dos de la inspección de hito (milestone) del estado. Lo que la ley estatal añade para esos edificios son los deberes de la junta directiva con los propietarios de las unidades, que aparecen en “Qué debe hacer la junta directiva”, arriba. Los demás edificios quedan fuera de la ley de inspecciones de hito y responden solo al BSIP.',
      },
      {
        q: '¿Qué pasa si el informe del BSIP enumera reparaciones?',
        a: 'El informe se presenta en cuanto está completo, aunque enumere reparaciones. Las reparaciones siguen después, con permiso, y mientras duran el ingeniero emite una carta firmada y sellada sobre si el edificio puede seguir ocupado. Una reinspección, un informe enmendado y una carta de finalización cierran el expediente; el plazo está en la fila “Si hay reparaciones” de la tabla de arriba.',
      },
      {
        q: '¿Qué pasa si no presentamos el informe del BSIP a tiempo?',
        a: 'La Política n.º 05-05 de la Junta de Reglas y Apelaciones establece que, cuando el informe no se presenta a tiempo y no se pidió una prórroga, el Building Official lleva el caso a una audiencia ante un magistrado especial (Special Magistrate) o ante la Junta de Cumplimiento de Códigos (Code Enforcement Board); y que, si no se hacen las reparaciones exigidas, el edificio puede declararse inseguro y no apto para ser ocupado. Cada ciudad puede fijar sus propios plazos y sanciones, así que los pasos los fija la oficina que envió su notificación. ¿Ya pasó la fecha de su notificación? Envíe la notificación y cualquier citación; el primer paso es hacer la inspección y presentar el informe.',
      },
      {
        q: 'Presentamos el informe con el programa anterior de 40 años. ¿Cuándo toca el siguiente?',
        a: 'Un edificio inspeccionado con el programa anterior de 40 años se considera en cumplimiento, y sus inspecciones siguientes llegan con el intervalo de la fila “Después” de la tabla de arriba. El año en que vence la suya no conviene calcularlo con una regla general: el Building Official de su ciudad envía la Notificación de Inspección Requerida, y su carta indica la fecha. Envíenos el último informe o la notificación, y la leemos primero.',
      },
    ],
    /* What is left under "Conviene saber" — see the EN block. The sentences
       are unchanged, except that the one on what IS inspected lost the "sí"
       that answered the list of exclusions it used to follow. */
    considerations: [
      /* "Una prórroga", never "una sola": the policy does not say whether
         more than one can be granted. */
      'El Building Official puede conceder una prórroga de hasta 60 días para presentar el informe.',
      /* Threshold buildings: neutral on purpose, claims no credential. */
      'Los edificios de más de tres pisos o 50 pies se consideran “threshold buildings” (edificios de umbral), y su informe estructural debe prepararlo un ingeniero con las calificaciones adicionales que exige el Condado de Broward. Lo confirmamos para su edificio antes de presentar una propuesta.',
      'Solo se aceptan los formularios estructural y eléctrico de la propia Junta de Reglas y Apelaciones — no el formulario de una firma — y se presentan además de un informe narrativo escrito con fotografías a color, no en su lugar.',
      'El informe enmendado y la carta de finalización los emite el profesional que inspeccionó el edificio y emitió el informe original. Si el suyo lo emitió otra firma, indíquelo al escribirnos — confirmamos qué hará falta para cerrar el expediente antes de presentar una propuesta.',
      'Los garajes de estacionamiento, las barandas de protección y los balcones, terrazas elevadas, muelles y muros de contención costeros (seawalls) que estén unidos a una estructura o la sostengan forman parte de la inspección.',
      /* "Completo" is the package, never the outcome — see the EN header. */
      'Un paquete completo todavía no es un expediente cerrado. Donde el informe enumere reparaciones, estas siguen con permiso, y lo que lo cierra es el informe enmendado con su carta de finalización.',
      /* The last two, in this page's terms — see the EN block. */
      'Una condición que ponga en peligro la vida o la propiedad se informa al propietario y al Building Official de su ciudad; el ingeniero tiene el deber de hacerlo.',
      'Un informe del BSIP documenta condiciones observadas; las ocultas pueden requerir investigación adicional, y ningún ingeniero puede garantizar cómo actuará el Building Official a partir de él.',
    ],
    notesToggle: 'Las {n} notas',
    /* ¿QUIÉN LE ENVIÓ LA NOTIFICACIÓN? — mirror of the EN `offices`; see the
       Miami-Dade block above for what is specific to the Spanish. */
    offices: {
      title: '¿Quién le envió la notificación?',
      lede: 'El programa es uno solo para todo el condado, y el Building Official (el funcionario de construcción) de cada ciudad envía las notificaciones y recibe los informes. Busque su ciudad abajo: junto a ella aparece su oficina de construcción, con su nombre en inglés.',
      rows: [
        { city: 'Fort Lauderdale', office: 'City of Fort Lauderdale Development Services Department' },
        { city: 'Hollywood', office: 'City of Hollywood Building Division' },
        { city: 'Pompano Beach', office: 'City of Pompano Beach Building Department' },
        { city: 'Hallandale Beach', office: 'City of Hallandale Beach Building Division' },
        { city: 'Deerfield Beach', office: 'City of Deerfield Beach Building Division' },
        { city: 'Pembroke Pines', office: 'City of Pembroke Pines Building Department' },
        { city: 'Miramar', office: 'City of Miramar Building, Planning & Zoning Department' },
        { city: 'Plantation', office: 'City of Plantation Department of Building Safety' },
        { city: 'Sunrise', office: 'City of Sunrise Building Division' },
        { city: 'Davie', office: 'Town of Davie Building Division' },
        { city: 'Cooper City', office: 'City of Cooper City Building Division' },
        { city: 'Coral Springs', office: 'City of Coral Springs Building Department' },
        { city: 'Dania Beach', office: 'City of Dania Beach Building Division' },
        { city: 'Hillsboro Beach', office: 'Town of Hillsboro Beach Building Department' },
        { city: 'Lauderdale Lakes', office: 'City of Lauderdale Lakes Building Division' },
        { city: 'Lauderhill', office: 'City of Lauderhill Building Division' },
        { city: 'Lighthouse Point', office: 'Lighthouse Point Building Department' },
        { city: 'Margate', office: 'City of Margate Building Department' },
        { city: 'Oakland Park', office: 'City of Oakland Park Building and Permitting Division' },
        { city: 'Pembroke Park', office: 'Town of Pembroke Park Building Department' },
        { city: 'Tamarac', office: 'City of Tamarac Building Department' },
        { city: 'Weston', office: 'City of Weston Building Code Services' },
        { city: 'Wilton Manors', office: 'Community Development Services Department' },
      ],
      note: '¿Su ciudad no está en la lista? El programa alcanza a todas las ciudades de Broward, y la carta indica la oficina que la envió. Las preguntas sobre una notificación se dirigen a esa oficina. Envíenos la carta: la leemos antes de presentar una propuesta.',
      forms: {
        text: 'Estos son los formularios en los que se presenta el informe (página oficial, en inglés):',
        label: 'Junta de Reglas y Apelaciones del Condado de Broward: formularios del Programa de Inspección de Seguridad de Edificios (BSIP)',
        url: 'https://www.broward.org/codeappeals/FormsandContacts',
      },
      checked: officeLinksChecked,
      toggle: '{n} oficinas de construcción, ciudad por ciudad',
    },
    /* EL PAQUETE DE BROWARD — mirror of the EN `packet`: the same seven
       rows in the same order. It is NOT Miami-Dade's list: no parking-lot
       certificate and no thermography rule here (read the EN comment). The
       two forms keep their English names in parentheses — that is what is
       printed on them. */
    packet: {
      label: 'El paquete del BSIP de Broward, parte por parte',
      lede: 'Lo que la Junta de Reglas y Apelaciones pide con una inspección de seguridad del edificio (Building Safety Inspection), y lo que nuestro equipo entrega para el suyo: dos inspecciones, la estructural y la eléctrica, en un solo informe escrito.',
      parts: [
        { k: 'Informe escrito', v: 'Un informe narrativo detallado de la inspección, firmado y sellado, que indica si el edificio es seguro en lo estructural y en lo eléctrico o qué reparaciones necesita.' },
        { k: 'Formulario estructural', v: 'El formulario de la propia Junta (Structural Safety Inspection Report Form), completado para el edificio: cimentaciones, muros, pisos y techo, estructura, ventanas y puertas exteriores. Las barandas son uno de sus puntos, y un garaje de estacionamiento se inspecciona con la estructura.' },
        { k: 'Formulario eléctrico', v: 'El formulario de la propia Junta (Electrical Safety Inspection Report Form): la acometida y sus equipos, los cuartos eléctricos, el cableado y la puesta a tierra, la iluminación de emergencia, la alarma contra incendios, las luces de salida y el cableado de estacionamientos y garajes.' },
        { k: 'Fotografías a color', v: 'Se incluyen con el informe para mostrar las condiciones observadas, sobre todo donde se encontraron defectos.' },
        { k: 'Datos de respaldo', v: 'Donde los haya, planos o croquis y, donde la inspección exigió ensayos, sus informes: se enumeran en el formulario estructural y se adjuntan a él.' },
        { k: 'Resumen para los propietarios', v: 'En un condominio o una cooperativa, un resumen del informe, preparado para que la asociación lo envíe a los propietarios de las unidades.' },
        { k: 'Lo que añade su ciudad', v: 'Algunas ciudades piden con la presentación una hoja de portada o un formulario propio. La carta de su ciudad indica qué quiere, y la leemos primero.' },
      ],
      note: 'Termografía infrarroja: la política vigente de la Junta de Reglas y Apelaciones no pide ese estudio; se usa donde la inspección eléctrica lo justifica.',
      toggle: 'Las {n} partes del paquete',
    },
    alsoCalled: ['BSIP', 'Building Safety Inspection Program', 'Programa de Inspección de Seguridad de Edificios de Broward', 'Recertificación de 40 años'],
    crossLink: { text: '¿Su edificio está en Miami-Dade?', label: 'Vea la recertificación de Miami-Dade', slug: 'building-recertification' },
    program: {
      id: 'broward',
      county: 'Broward',
      eyebrow: 'Condado de Broward · Programa de Inspección de Seguridad de Edificios (BSIP)',
      /* "180 días" must always equal the row's "Plazo para presentar". */
      titleLines: ['BSIP de Broward.', '180 días desde la notificación.'],
      accentWord: '180 días',
      /* 45 words at most, as in English: what waiting costs, then the way
         out. The full program name is already in the label above it. */
      lede: 'Si el informe no se presenta a tiempo, el caso pasa a una audiencia de cumplimiento, y un edificio sin reparar puede declararse inseguro. ¿Ya pasó la fecha? Todavía tiene solución — envíenos la notificación hoy y reciba una propuesta a precio fijo, sin costo.',
      steps: ['Revisión de la notificación', 'Inspección', 'Informe presentado', 'Reparaciones y cierre'],
      cta: 'Enviar la notificación de Broward',
      timingLink: 'Plazos y exenciones de Broward',
      detail: 'El BSIP en detalle',
    },
    /* The title leads with the words people type: "BSIP", "Broward" and the
       name most owners still give the program — "antes", never as a rule in
       force (see the EN block; do not move it back to the keywords). The
       program's full name opens the description and is the H1. The English
       queries stay in the keywords — the letter is in English and so is
       most of what people search for. No ages and no day counts. The title
       ends at the former name: "— Ingeniero estructural" did not fit. */
    seo: {
      title: 'BSIP de Broward (antes recertificación de 40 años)',
      /* It used to end "Un P.E. de Florida presenta el informe
         estructural": half the program, and one person — see the EN block. */
      description:
        'Programa de Inspección de Seguridad de Edificios (BSIP) de Broward, aún llamado recertificación de 40 años: inspección estructural y eléctrica completa.',
      keywords: ['ingeniero BSIP Broward', 'programa de inspección de seguridad de edificios Broward', 'inspección de edificios de 25 años Broward', 'BSIP Broward', 'Broward BSIP engineer', 'building safety inspection program Broward', 'recertificación 40 años Broward', 'inspección eléctrica BSIP Broward', 'BSIP electrical safety inspection'],
    },
  },
  {
    /* Renamed from `building-safety-inspections` — see the EN block for why,
       and for what this page is now for. */
    slug: 'milestone-inspections',
    n: '03',
    title: 'Inspecciones de hito (milestone)',
    shortTitle: 'Inspecciones de hito (milestone)',
    track: 'existing',
    summary:
      'La inspección de hito (milestone) de Florida explicada para su edificio, la investigación adicional cuando un informe la exige, y las inspecciones de seguridad estructural fuera del ciclo de un programa.',
    /* "Miami-Dade y Broward, Florida" under "Cobertura", on this page and
       the five below: with "Condados de…" (`serviceAreaLabel`) the fact was
       a six-word line on six pages. Spanish only — the English label is
       short enough as it is. */
    card: {
      when: 'La junta directiva no sabe qué inspección debe el edificio, un informe exige investigación adicional, o hay un motivo para revisar y ninguna notificación.',
      receive: 'Un informe de inspección con los hallazgos por orden de prioridad y, en condominios y cooperativas, un resumen que la junta puede enviar a los propietarios.',
      next: 'Díganos dónde está el edificio, qué edad y cuántos pisos tiene, y qué motivó la pregunta.',
    },
    /* The page's own first line — see the EN block, and its note on length:
       measured on a phone like the English one. */
    heroSub:
      'Qué reglas alcanzan a su edificio, cómo se cumple en su condado la inspección de hito (milestone) de Florida, y las inspecciones de seguridad estructural cuando no hay notificación.',
    /* The H1 names who it is for and where — see the EN block. Shorter than
       a literal translation: "de Florida" is in the line under it, and at
       phone size every extra word is another line. */
    headings: {
      h1: 'Inspecciones de hito (milestone) para condominios en Miami-Dade y Broward',
      considerations: 'A qué edificios alcanza la ley, y qué puede ver una inspección.',
    },
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
      { step: 'Aplicabilidad', detail: 'Confirmamos qué reglas alcanzan al edificio y qué pide la notificación, si la hay. Donde aplica el programa de un condado, el trabajo se hace bajo ese programa, y nuestro equipo entrega el paquete completo que ese condado pide.' },
      { step: 'Revisión de registros', detail: 'Planos disponibles, informes previos e historial de reparaciones revisados antes de la visita al edificio.' },
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
         the county program in both counties, not beside it. The two county
         sentences are `countyPages` below, each under a heading that links
         to that county's page. */
      note: 'Los deberes de la junta directiva con los propietarios de las unidades aplican en ambos condados.',
      rows: [
        {
          jurisdiction: 'Estado de Florida — inspección de hito',
          source: 'Estatutos de Florida, Sección 553.899',
          /* Same link as the EN row. */
          sourceUrl:
            'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0553/Sections/0553.899.html',
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
      'Para edificios de más de tres pisos o 50 pies, cada condado exige que el informe estructural lo prepare un ingeniero con calificaciones adicionales. Lo confirmamos para su edificio antes de presentar una propuesta.',
      'Una inspección reporta la condición en un momento dado; no es una garantía de desempeño futuro.',
    ],
    /* One heading per county, and the heading is the link — see the EN
       block. "No se presenta un informe de hito aparte" is said for
       Miami-Dade only. */
    countyPages: [
      {
        slug: 'building-recertification',
        title: 'En Miami-Dade, el informe de recertificación es su inspección de hito',
        text: 'La recertificación de Miami-Dade sirve como cumplimiento de la inspección de hito del estado — allí no se presenta un informe de hito aparte. El plazo de su notificación es el del programa del condado, y está en esa página.',
      },
      {
        slug: 'broward-bsip',
        title: 'En Broward, el informe del BSIP es su inspección de hito',
        text: 'El informe del BSIP de Broward sirve como fase uno y fase dos de la inspección de hito del estado. El plazo de su notificación es el del programa del condado, y está en esa página.',
      },
    ],
    /* Mirror of the EN comparison: same four labels, same four rows, no age
       and no deadline. The reserve study keeps its English name and acronym
       on first mention, as boards hear it from their manager and their
       lawyer; whether the firm prepares one is NOT said (see the EN block). */
    comparison: {
      title: 'Recertificación, BSIP, inspección de hito y SIRS, lado a lado',
      labels: ['Quién lo exige', 'Qué edificios', 'Qué produce', 'Dónde se presenta'],
      rows: [
        {
          name: 'Recertificación de Miami-Dade',
          values: [
            'El Condado de Miami-Dade. La notificación la envía el Building Official (el funcionario de construcción) de su ciudad, o el condado en las áreas no incorporadas.',
            'Casi todos los edificios, salvo las viviendas unifamiliares y los dúplex; la lista completa está en la página de Miami-Dade.',
            'Un informe estructural y un informe eléctrico, cada uno en el formulario del propio condado, presentados con los certificados y anexos que el condado pide.',
            'Ante el Building Official que envió la notificación.',
          ],
        },
        {
          name: 'BSIP de Broward',
          values: [
            'El Condado de Broward, a través de su Junta de Reglas y Apelaciones (Board of Rules and Appeals). Lo hace cumplir el Building Official de su ciudad.',
            'Casi todos los tipos de edificio, en todas las ciudades de Broward; las viviendas y las estructuras menores que quedan fuera están en la página del BSIP.',
            'Un informe narrativo escrito, con los formularios estructural y eléctrico de la propia Junta y fotografías a color.',
            'Ante el Building Official de su ciudad.',
          ],
        },
        {
          name: 'Inspección de hito (milestone) del estado',
          values: [
            'El Estado de Florida.',
            'Edificios de condominio y cooperativa de tres pisos habitables o más.',
            'Un informe de inspección de fase uno y, solo donde la fase uno encuentra deterioro estructural sustancial, una fase dos. En Miami-Dade y en Broward, el informe del condado sirve como tal.',
            'Ante la asociación y el Building Official — en Miami-Dade y en Broward, como el informe del programa del condado.',
          ],
        },
        {
          name: 'Estudio de reservas de integridad estructural (SIRS, por structural integrity reserve study)',
          values: [
            'El Estado de Florida, en sus leyes de condominios y de cooperativas.',
            'Edificios residenciales de condominio y cooperativa de tres pisos habitables o más.',
            'Un estudio de reservas, no un informe de inspección: cuánto costará reparar o reemplazar el techo, la estructura y las demás partes del edificio que la ley enumera, y cuánto debería reservar la asociación cada año.',
            'La asociación lo comparte con los propietarios de las unidades e informa a la división de condominios del estado de que se completó.',
          ],
        },
      ],
      source:
        'Código del Condado de Miami-Dade, Sección 8-11(f) · Junta de Reglas y Apelaciones del Condado de Broward, Política n.º 05-05 · Estatutos de Florida, Secciones 553.899, 718.112 y 719.106',
    },
    /* The title is what a board types — "inspección de hito (milestone)" —
       and the two counties. "Para condominios" and the trade used to be in
       it too, and it was 902 px of the 580 a search result shows; the
       condominiums open the description and are in the H1. */
    seo: {
      title: 'Inspecciones de hito (milestone) en Miami-Dade y Broward',
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
    card: {
      when: 'Un informe enumera reparaciones, han aparecido grietas o desprendimientos, o va a comprar o modificar un edificio.',
      receive: 'Un informe de evaluación con el deterioro mapeado y, cuando se diseñan las reparaciones, planos y especificaciones que un contratista puede cotizar.',
      next: 'Empiece por las fotografías y cualquier informe anterior; le decimos si hace falta una visita.',
    },
    heroSub:
      'Qué significan realmente las grietas, los desprendimientos o el informe que tiene en las manos — y reparaciones especificadas para que todos coticen lo mismo.',
    headings: {
      faq: 'Preguntas sobre grietas, desprendimientos y reparaciones',
      considerations: 'Lo que una evaluación resuelve, y lo que deja abierto.',
    },
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
      'Envíe fotografías de las condiciones y cualquier informe previo. Le decimos si hace falta una visita al edificio y qué cubrirá la evaluación.',
    considerations: [
      /* "Evaluaciones estructurales", the words of the H1: the page under
         it said "estructural" and "estructuras", never the plural. */
      'Las evaluaciones estructurales de edificios existentes conllevan incertidumbre; donde importa, se recomiendan ensayos o aperturas exploratorias en lugar de dar la incertidumbre por resuelta.',
      'La falta de documentación original aumenta la verificación en campo requerida.',
      'El diseño de reparaciones se define y cotiza por separado de la evaluación que lo origina.',
    ],
    /* The same four questions as the EN block, under the same rules. */
    faq: [
      {
        q: '¿Cómo sabemos si una grieta es importante?',
        a: 'Por dónde está, cómo corre y qué carga el elemento que la rodea. Algunas grietas vienen de la retracción del concreto o de los acabados y solo hay que vigilarlas; otras, con manchas de óxido o concreto que se desprende, indican refuerzo en corrosión. La evaluación clasifica cada condición en un grupo o en el otro, elemento por elemento.',
      },
      {
        q: '¿Las fotografías pueden reemplazar una visita al edificio?',
        a: 'Son el primer paso correcto, aunque no siempre el último. Con las fotografías y cualquier informe anterior podemos decirle si hace falta una visita y qué debe revisar. Donde una condición no se puede juzgar desde la superficie, el informe recomienda ensayos o una apertura exploratoria en lugar de suponer.',
      },
      {
        q: '¿Por qué no coinciden las ofertas de los contratistas?',
        a: 'Porque cada uno cotizó una reparación distinta. Cuando un informe enumera reparaciones sin definirlas, una oferta cubre un parcheo superficial y la siguiente un reemplazo completo. Los planos y las especificaciones de reparación fijan las ubicaciones, el método y la extensión, para que todos coticen el mismo trabajo y las ofertas se puedan comparar.',
      },
      {
        q: 'Vamos a comprar un edificio. ¿Qué nos dice una evaluación?',
        a: 'En qué condición está hoy la estructura y qué significa eso para la compra: el deterioro encontrado, dónde está, qué tan serio es y qué reparaciones van primero. Si faltan los planos originales, se verifica más en campo, y lo que la visita no pueda resolver queda señalado en el informe como pendiente.',
      },
    ],
    /* "Sur de Florida", as in English: with the two counties this title
       is 610 px, and a result shows 580. */
    seo: {
      title: 'Evaluaciones estructurales y reparaciones — Sur de Florida',
      description:
        'Evaluaciones de condición estructural y diseño de reparaciones de concreto para edificios existentes del Sur de Florida: qué significa el daño y cómo repararlo.',
      keywords: ['evaluación de condición estructural Miami', 'ingeniero de reparación de concreto Florida', 'diseño de reparación de balcones', 'evaluación de edificios existentes', 'due diligence estructural Miami'],
    },
  },
  /* ── NEW PROJECTS ──────────────────────────────────────────────────────── */
  {
    slug: 'threshold-inspections',
    n: '05',
    title: 'Inspecciones de edificios threshold',
    shortTitle: 'Inspecciones threshold',
    track: 'existing',
    coverage: 'Condados de Miami-Dade y Broward, Florida',
    summary:
      'Los programas de inspección del condado aplicados a un edificio threshold — de más de tres pisos o cincuenta pies — con el informe estructural, la carta de autocalificación y la revisión de fachada que su tamaño exige.',
    card: {
      when: 'Su edificio tiene más de tres pisos o cincuenta pies, y la notificación del condado ya llegó o su fecha está cerca.',
      receive: 'El paquete completo del condado para un edificio threshold: informes estructural y eléctrico, la carta de autocalificación del ingeniero estructural y la revisión de fachada donde el acristalamiento lo exige.',
      next: 'Envíenos la notificación, o la dirección del edificio y su número de pisos, y le decimos qué programa y qué informe necesita.',
    },
    heroSub:
      'Un edificio de más de tres pisos o cincuenta pies responde al condado con un expediente más completo: un ingeniero estructural con la especialización del estado, una carta de autocalificación y la fachada también revisada.',
    headings: {
      faq: 'Preguntas sobre los edificios threshold',
      considerations: 'Qué hace que un edificio sea threshold, y qué cambia con eso.',
    },
    problemTitle: 'Un edificio alto le debe al condado más que un informe.',
    problem:
      'Miami-Dade y Broward aplican los mismos programas de inspección a todo edificio que envejece, pero a un edificio threshold — de más de tres pisos o cincuenta pies, o con un gran espacio de reunión — le exigen más: su informe estructural tiene que venir de un ingeniero estructural con la especialización estructural del estado, con una carta de autocalificación adjunta, y una fachada acristalada tiene una inspección propia. Muchos propietarios se enteran cuando el condado devuelve el informe.',
    audience: [
      'Juntas de condominios y cooperativas de edificios de más de tres pisos',
      'Propietarios y administradores de torres, estacionamientos y grandes edificios de reunión',
      'Administradores de propiedades que atienden la notificación de un edificio threshold',
    ],
    when: [
      'La notificación del condado nombra un edificio de más de tres pisos o cincuenta pies, o un gran espacio de reunión.',
      'Un informe presentado por un edificio threshold volvió por la calificación del ingeniero estructural o por faltar la carta de autocalificación.',
      'La fachada lleva acristalamiento estructural sellado y le toca su propia inspección.',
    ],
    capabilities: ['Informe estructural', 'Carta de autocalificación', 'Informe eléctrico', 'Revisión de fachada'],
    scope: [
      'Qué programa y qué informe debe el edificio: la recertificación, el Programa de Inspección de Seguridad de Edificios o la inspección de hito que ambos satisfacen',
      'Inspección y informe estructural por un ingeniero estructural que cumple los requisitos de los condados para edificios threshold, con la carta de autocalificación',
      'Inspección y informe eléctrico por un ingeniero de la disciplina eléctrica',
      'Revisión de la fachada y del acristalamiento estructural sellado donde el edificio lo tiene',
      'Alcance de reparaciones para lo que la inspección encuentra, y la reinspección que cierra el expediente',
      'Presentación ante el oficial de construcción en los formularios del condado',
    ],
    process: [
      { step: 'Clasificar', detail: 'La altura, la ocupación y el acristalamiento del edificio deciden el programa, el informe y quién puede prepararlo.' },
      { step: 'Inspeccionar', detail: 'Inspecciones estructural y eléctrica en sitio, y la fachada donde el edificio tiene acristalamiento estructural.' },
      { step: 'Informar', detail: 'Los informes en los formularios del condado, con la carta de autocalificación adjunta, presentados ante el oficial de construcción.' },
      { step: 'Cerrar', detail: 'Alcance de reparaciones si algo aparece, la reinspección y la carta que cierra el expediente.' },
    ],
    deliverables: [
      'Informe estructural en el formulario del condado, con la carta de autocalificación',
      'Informe eléctrico en el formulario del condado',
      'Informe de fachada y acristalamiento estructural donde aplica',
      'Alcance de reparaciones, y la reinspección que cierra el expediente',
    ],
    nextStep:
      'Envíenos la notificación, o la dirección y el número de pisos, y le decimos bajo qué programa cae el edificio y qué debe llevar su informe.',
    considerations: [
      'Un edificio threshold tiene más de tres pisos o cincuenta pies, o una ocupación de reunión de más de 5,000 pies cuadrados y 500 personas; Miami-Dade inspecciona igual cualquier edificio de cuatro pisos o más.',
      'Los dos condados piden que el informe estructural de un edificio threshold venga de un ingeniero estructural con la especialización estructural del estado — en Broward, uno con licencia de Inspector Especial — con una carta de autocalificación; el informe eléctrico, de un ingeniero de la disciplina eléctrica.',
      'En Miami-Dade, un edificio threshold con fachada de acristalamiento estructural sellado tiene esa fachada inspeccionada en su propio ciclo, cada cinco años.',
    ],
    faq: [
      {
        q: '¿Mi edificio es un edificio threshold?',
        a: 'Si tiene más de tres pisos o mide más de cincuenta pies, sí; también lo es un edificio con un espacio de reunión de más de 5,000 pies cuadrados para más de 500 personas. Miami-Dade aplica la misma regla a cualquier edificio de cuatro pisos o más. Envíenos la dirección y se lo confirmamos.',
      },
      {
        q: '¿Por qué nos devolvieron el informe?',
        a: 'Casi siempre por la calificación: los condados aceptan el informe estructural de un edificio threshold solo de un ingeniero estructural con la especialización estructural del estado — en Broward, uno que además tiene licencia de Inspector Especial — y solo con una carta de autocalificación adjunta. Un informe sin ese expediente se devuelve, y el plazo sigue corriendo.',
      },
      {
        q: '¿La fachada necesita su propia inspección?',
        a: 'En Miami-Dade, cuando es acristalamiento estructural sellado, sí: el condado pide un informe de fachada cada cinco años, en su propio ciclo, aparte del informe del programa. Le decimos si su fachada cae en ese caso.',
      },
      {
        q: '¿Es un programa distinto de la recertificación o del BSIP?',
        a: 'No. Es el mismo programa del condado — la recertificación en Miami-Dade, el Programa de Inspección de Seguridad de Edificios en Broward, y la inspección de hito del estado que ambos satisfacen — aplicado a un edificio que, por su tamaño, debe un expediente más completo. La notificación, las fechas y los formularios son los del programa; lo que cambia es quién puede preparar el informe estructural y qué lo acompaña.',
      },
    ],
    seo: {
      title: 'Inspecciones de edificios threshold — Miami-Dade y Broward',
      description:
        'Recertificación, BSIP e inspecciones de hito de edificios threshold en Miami-Dade y Broward, con el informe estructural que su tamaño exige.',
      keywords: ['recertificación edificio threshold Miami-Dade', 'BSIP edificio threshold Broward', 'ingeniero estructural autocalificación threshold', 'inspección edificio threshold Florida'],
    },
  },
  {
    slug: 'peer-review',
    n: '06',
    title: 'Revisión por pares',
    shortTitle: 'Revisión por pares',
    track: 'new',
    summary:
      'Una segunda lectura independiente del diseño estructural — cumplimiento de código, trayectoria de carga, constructibilidad y calidad de la documentación.',
    card: {
      when: 'Un prestamista o una aseguradora pide una revisión independiente, un juego de planos está por emitirse, o algo en la estructura le preocupa.',
      receive: 'Un informe de revisión y un registro de comentarios priorizados, con seguimiento hasta cerrar cada uno.',
      next: 'Envíe los planos y los cálculos, y díganos qué debe responder la revisión.',
    },
    heroSub:
      'Un ingeniero independiente lee sus planos y cálculos según el código aplicable antes de que se emitan, y sigue hasta cerrar cada comentario.',
    headings: {
      h1: 'Revisión estructural independiente por pares',
      faq: 'Preguntas sobre la revisión estructural por pares',
      considerations: 'Qué es una revisión por pares, y qué no es.',
    },
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
    faq: [
      {
        q: '¿Una revisión por pares rediseña nuestro proyecto?',
        a: 'No. El revisor lee el diseño tal como lo preparó su ingeniero y señala lo que requiere atención; el equipo de diseño conserva el control de sus planos. Cada hallazgo indica su consecuencia estructural, de modo que su ingeniero decide cómo resolverlo, y la revisión lee esa respuesta antes de cerrar el comentario.',
      },
      {
        q: '¿Qué tan a fondo llega la revisión?',
        a: 'Tan a fondo como lo exija la pregunta que debe responder. Puede cubrir todo el juego de planos, algunos sistemas como las cimentaciones o el sistema lateral, o una sola inquietud. Esa profundidad se acuerda antes de empezar la lectura, y la propuesta fija los honorarios para ella.',
      },
      {
        q: '¿Qué tenemos en la mano cuando termina la revisión?',
        a: 'Un informe escrito y un registro de cada comentario, ordenado según su importancia para la estructura. A medida que el equipo de diseño responde, cada respuesta se lee y su comentario se marca como cerrado, de modo que el expediente del proyecto muestra qué se encontró y cómo se resolvió cada punto.',
      },
      {
        q: '¿Cuál es el mejor momento para pedirla?',
        a: 'Antes de emitir los planos para el permiso o para la construcción. Un problema detectado en el papel cuesta un comentario y una hoja corregida; detectado en obra, el mismo problema se convierte en un retraso y una orden de cambio. La revisión también ayuda más adelante, cuando algo en la obra genera una duda.',
      },
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

/* The two strings of the home page's form, said without a notice. Printed
   by `ui.form.home` and read as `home.form`: one object, so the two keys
   cannot drift (the Spanish twin of `ui.form.home` in site.ts). */
const homeForm = {
  messagePlaceholder:
    'Tipo de edificio, lo que necesita inspeccionar, evaluar o revisar y cualquier otro dato que debamos saber.',
  attachmentsHint:
    'Fotografías, planos o informes. PDF, imágenes, DWG, DXF o ZIP, hasta 25 MB cada uno, cinco archivos.',
  /* What the visitor reads after sending, said by the firm (the Spanish twin
     of `ui.form.home` in site.ts: read the comment there). */
  successBody: 'Gracias. Le escribiremos por correo electrónico.',
  successNote: 'Enviar esto no nos contrata. Nada comienza hasta que usted acepte un alcance de trabajo por escrito.',
  nextSteps: [
    'Leemos su descripción y los archivos que haya adjuntado.',
    'Le escribimos por correo electrónico, con preguntas o con un alcance de trabajo por escrito.',
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   BUNDLE
   ═══════════════════════════════════════════════════════════════════════════ */

/* The Privacy page while Google Ads measurement is ON — the Spanish twin of
   `privacyAds` in site.ts. Read the comment there: what each sentence was
   checked against, the one flag that prints it (ADS.on, ads.ts), and why it
   names Google's pages without linking them. Same content as the English,
   written as Spanish: "la etiqueta" is Google's tag throughout, so the label
   that tells the three conversions apart is "un código". */
const privacyAds = {
  h: 'Cookies, analítica y publicidad',
  /* Opens "Qué recopilamos" in place of "La": see the English comment. */
  collect:
    'Aparte de lo que registra la etiqueta publicitaria de Google cuando un visitante llega desde uno de nuestros anuncios (se describe más abajo, en “Cookies, analítica y publicidad”), la',
  p: [
    'Las páginas públicas de este sitio no ejecutan scripts de analítica ni de redes sociales, y el formulario no usa ningún servicio externo de verificación (CAPTCHA). Sus scripts, tipografías, fotografías y videos se sirven desde la propia dirección de este sitio, con una excepción, que es también el único caso en que estas páginas instalan cookies: el de quien llega haciendo clic en uno de nuestros anuncios de Google.',
    'El enlace de un anuncio lleva un identificador de clic que Google añade a la dirección que abre. Solo cuando la dirección por la que usted llega lo trae, estas páginas cargan la etiqueta publicitaria de Google, un script que se sirve desde googletagmanager.com. Quien llega desde un resultado de búsqueda corriente, desde otro enlace o escribiendo la dirección no recibe la etiqueta, salvo que una visita anterior a través de un anuncio haya dejado las cookies que se describen a continuación. La usamos para una sola cosa: saber qué anuncio dio lugar a una llamada, a un chat de WhatsApp o a una solicitud enviada por el formulario.',
    `La etiqueta guarda en su navegador el identificador de clic y un número aleatorio: en cookies bajo la dirección de este sitio cuyos nombres empiezan por “_gcl_”, y en una entrada del almacenamiento local del navegador. Google puede instalar además una cookie propia, con el mismo identificador, en sus direcciones de publicidad (google.com, googleadservices.com y doubleclick.net). Las cookies se crean con una caducidad de ${ADS_COOKIE_DAYS} días, que su navegador puede acortar. Mientras duran, la etiqueta se vuelve a cargar cada vez que usted regresa a estas páginas.`,
    'Cada vez que una de estas páginas se carga por completo, la etiqueta envía a Google el identificador de clic, el número aleatorio y la dirección de la página. Cuando usted toca un enlace de teléfono, abre el enlace de WhatsApp o envía el formulario, los envía de nuevo con la dirección de la página en la que usted está, un código que indica cuál de las tres cosas ocurrió y datos técnicos de su navegador y de su dispositivo, como sus versiones y el tamaño de la pantalla. Como en cualquier solicitud que hace un navegador, Google ve también su dirección de internet (IP). Lo que usted escribe en el formulario no forma parte de ello: la etiqueta se ejecuta en un marco propio, aparte de la página y de su formulario, y no le entregamos su nombre, su correo electrónico ni su teléfono, tampoco su descripción ni sus archivos, ni la referencia de su solicitud.',
    'Hemos desactivado, en la configuración de la propia etiqueta, el uso de estos eventos para personalizar anuncios y para crear listas de remarketing. Google los recibe como la empresa que gestiona los anuncios y los trata conforme a su propia política de privacidad y a sus condiciones, que no controlamos. Para eliminar lo que la etiqueta guardó, borre en su navegador las cookies y los datos de este sitio; después, la etiqueta no vuelve a cargarse salvo que usted llegue desde otro de nuestros anuncios. Los controles de Google sobre los anuncios que le muestra están en myadcenter.google.com.',
  ],
};

export const es: SiteContent = {
  company: {
    legalName: 'Tercero Tablada Civil and Structural Engineering Inc.',
    name: 'Tercero Tablada Civil and Structural Engineering Inc.',
    shortName: 'Tercero Tablada',
    discipline: 'Ingeniería Civil y Estructural',
    url: 'https://ttcivilstructural.com',
    /* Existing buildings first, each county's program by its own name — the
       order the whole site follows. No number belongs here. */
    description:
      'Ingeniería estructural para el Sur de Florida — recertificación de edificios en Miami-Dade, el Programa de Inspección de Seguridad de Edificios (BSIP) en Broward, inspecciones de hito (milestone), evaluaciones estructurales y diseño de reparaciones, las inspecciones del condado para edificios threshold y la revisión por pares de un diseño estructural.',
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
      lockupDarkSm: '/ttc/img/logo-horizontal@640.webp',
      markSmSize: { w: 256, h: 256 },
      lockupSmSize: { w: 640, h: 244 },
      markDarkXs: '/ttc/img/logo-square@144.webp',
      markLightXs: '/ttc/img/logo-white@144.webp',
      markXsSize: { w: 144, h: 144 },
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
    /* By name, without its number — see `company.registry` in site.ts. */
    registry: 'Empresa de ingeniería registrada en Florida' as string | null,
    registryNumber: '40285' as string | null,
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
    phone: { display: '(772) 265-8506', href: 'tel:+17722658506' },
    whatsapp: { href: 'https://api.whatsapp.com/send?phone=17722658506' },
    address: null,
    serviceAreaLabel: 'Florida, todo el estado',
    social: {
      linkedin: 'https://www.linkedin.com/company/ttcivilstructural/',
      facebook: 'https://www.facebook.com/ttcivilstructural/',
      instagram: 'https://www.instagram.com/ttcivilstructural/',
      nextdoor: 'https://nextdoor.com/page/tercero-tablada-civil-and-structural-engineering-inc-miami-fl/',
    },
  },

  /* The same entries in the same order as site.ts (site.test.ts compares
     the two). /projects is out of the header and named for what it holds:
     "Proyectos" promised past projects the page does not show. */
  primaryNav: [
    { href: '/services', label: 'Servicios' },
    { href: '/existing-buildings', label: 'Edificios existentes' },
    { href: '/projects', label: 'Trabajos típicos', inHeader: false },
    { href: '/guides', label: 'Guías' },
    { href: '/resources', label: 'Recursos', inHeader: false },
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
        { href: '/projects', label: 'Trabajos típicos' },
        { href: '/guides', label: 'Guías' },
        { href: '/resources', label: 'Recursos' },
        { href: '/about', label: 'Nosotros' },
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
      /* Each language by its own name, as in site.ts: a Spanish page says
         "English". */
      en: 'English',
      es: 'Español',
      unavailable: 'Versión en inglés no disponible',
    },
    breadcrumb: 'Ruta de navegación',
    onThisPage: 'En esta página',
    explore: 'Explorar',
    requestProposal: 'Solicitar propuesta',
    seeAllServices: 'Todos los servicios',
    newProjects: 'Revisión de diseño',
    existingBuildings: 'Edificios existentes',
    whenYouNeedIt: 'Cuándo lo necesita',
    whatsIncluded: 'Qué incluye',
    whatYouReceive: 'Qué recibe',
    scopeAndDeliverables: 'Alcance y entregables',
    nextStep: 'Siguiente paso',
    whenItApplies: 'Cuándo aplica',
    howItRuns: 'Cómo se desarrolla el trabajo',
    considerations: 'Conviene saber',
    /* Was "Qué cambia el alcance…", word for word. Both halves of the
       English heading are kept; the label right above it is already
       "Conviene saber", so the heading must not say that again. */
    considerationsTitle: 'De qué depende el trabajo, y lo que ningún ingeniero puede prometer.',
    faqLabel: 'Preguntas y respuestas',
    faqTitle: 'Preguntas frecuentes',
    /* The FAQ answers point at the list by this name, in curly quotes. */
    boardDuties: 'Qué debe hacer la junta directiva',
    inBothCounties: 'En Miami-Dade y Broward',
    stepYourPart: 'Su parte',
    stepYouGet: 'Usted recibe',
    /* Was "Pausar video de fondo": the one switch now also stops the ribbon
       of service names on the home page. */
    pauseMotion: 'Pausar el movimiento',
    typicalEngagements: 'Trabajos típicos',
    relatedServices: 'Servicios relacionados',
    atAGlance: 'De un vistazo',
    coverage: 'Cobertura',
    verified: 'Verificado',
    lastChecked: 'Última verificación',
    sourceLabel: 'Fuente',
    yourCity: 'Su ciudad',
    /* "Revisión", not "verificación": that word is the rules' ("Última
       verificación"), and this date is about the offices' names. It said
       "de los enlaces" while the rows were links (see `offices` in
       site.ts). */
    linksChecked: 'Última revisión de los nombres de las oficinas',
    footer: {
      services: 'Servicios',
      contact: 'Contacto',
      navigate: 'Navegar',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      instagram: 'Instagram',
      imageCredits: 'Créditos de imágenes',
    },
    engineer: {
      eyebrow: 'Conozca al ingeniero',
      role: 'Ingeniero Principal',
      credential: 'Ingeniero Profesional (P.E.) con licencia en Florida',
      license: 'Licencias en Florida',
      verify: 'Verificar en el DBPR de Florida',
      /* "Ingeniero", never "firmado por" — see the EN comment in site.ts. */
      label: 'Ingeniero',
      education: 'Formación',
      focus: 'Áreas de especialidad',
      approach: 'Cómo trabajo',
      forYou: 'Qué significa eso para usted',
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
      illustrative: 'Imagen ilustrativa',
      firmProjects: 'Proyectos de la firma',
      priorExperience: 'Experiencia profesional previa',
      priorNote:
        'Trabajo realizado en otras empresas antes de fundar la firma. Se lista solo como experiencia — no son proyectos de Tercero Tablada Civil and Structural Engineering Inc.',
    },
    form: {
      heading: 'Solicitar propuesta',
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      service: 'Servicio requerido',
      selectService: 'Seleccione un servicio…',
      location: 'Ubicación del proyecto',
      locationPlaceholder: 'p. ej. Coral Gables, Miami-Dade',
      message: 'Descripción del proyecto',
      messagePlaceholder:
        'Tipo de edificio, número de pisos, qué necesita inspeccionar, evaluar o revisar, y cualquier plazo o notificación que tenga pendiente.',
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
      successBody: 'Su solicitud está en la bandeja del ingeniero. Normalmente respondemos en menos de dos horas.',
      successNote: 'Enviar esto no nos contrata ni cambia su plazo. Nada comienza hasta que usted acepte una propuesta escrita.',
      successConfirmed: 'Se envió una confirmación a su correo electrónico.',
      successRef: 'Referencia',
      whatNext: 'Qué sigue',
      nextSteps: [
        'El ingeniero lee su descripción y los archivos que haya adjuntado.',
        'Recibe una respuesta por correo electrónico con preguntas, o con una propuesta que establece el alcance del trabajo, los entregables y los honorarios.',
        /* "Nada se asume" was "nothing is assumed": in Spanish "asumir" is
           to take something on, not to take it for granted. */
        'El trabajo comienza una vez que el alcance se acuerda por escrito — no se da nada por sentado en su nombre.',
      ],
      directEmail: '¿Prefiere el correo electrónico? Escriba a',
      /* Mirror of `program` in site.ts. "Carta" throughout, the word the
         buttons use ("Basta una foto de la carta"). */
      program: {
        attachments: 'Suba la foto de la carta',
        attachmentsHint:
          'Basta una foto de la carta tomada con el teléfono; un PDF también sirve. Hasta cinco archivos de 25 MB cada uno.',
        location: 'Dirección del edificio',
        locationPlaceholder: 'Calle, número y ciudad',
        message: 'Comentarios',
        messagePlaceholder:
          'Lo que quiera que sepamos. ¿Aún no tiene la carta? Indíquenos la antigüedad del edificio.',
      },
      /* Mirror of `home` in site.ts: the form of the home page, which names
         no notice. `home.form` is this same object. */
      home: homeForm,
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
      office: 'Oficina',
    },
    typologiesNote:
      'Las fotografías ilustran el tipo de estructura descrito; ninguna muestra un proyecto de Tercero Tablada Civil and Structural Engineering Inc. Lo que realiza la firma se describe en',
    typologiesNoteLink: 'Trabajos típicos',
    typologiesNoteEnd: '.',
    galleryNote:
      'Fotografía arquitectónica con licencia, mostrada como material y no como portafolio. Ninguna imagen de esta página muestra un proyecto de Tercero Tablada Civil and Structural Engineering Inc.',
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

  /* The Spanish twin of `home` in site.ts: read the comment there, it holds
     the owner's rules. Usted throughout ("Contáctenos", "Cuéntenos",
     "Escríbanos"); "presentamos" for "file with", the site's own verb. The
     three-line headings are written to the same line count as the English
     (the hero's third line is the widest: do not lengthen it). Which
     words stay in English: Miami-Dade, Broward, BSIP, BIM, WhatsApp,
     "milestone" beside "hitos" (the law's name), Townhouses. */
  home: {
    order: [
      'building-recertification',
      'broward-bsip',
      'structural-condition-assessments',
      'milestone-inspections',
      'threshold-inspections',
      'peer-review',
    ],
    chrome: {
      headerCta: 'Contáctenos',
      callLabel: 'Llamar {phone}',
      barLabel: 'Contactar a la firma',
    },
    form: homeForm,
    hero: {
      titleLines: ['Ingenieros para', 'los edificios', 'de Florida.'],
      accentWord: 'Florida.',
      sub: 'Ingenieros Profesionales con licencia en ingeniería civil, estructural y eléctrica. Inspeccionamos, evaluamos y revisamos edificios en todo el estado, para los propietarios, juntas y oficiales de construcción que deben actuar sobre lo que encontramos.',
      cta: 'Contáctenos',
      counties: ['En toda Florida'],
    },
    ribbon: {
      label: 'Lo que hacemos',
      sideNew: 'Revisión de diseño',
      sideExisting: 'Edificios existentes',
      types: [
        'Viviendas',
        'Townhouses',
        'Concreto de mediana altura',
        'Uso mixto',
        'Estructuras comerciales',
        'Cimentaciones',
        'Diseño de reparaciones',
      ],
    },
    services: {
      label: 'Servicios',
      title: 'Seis servicios. Un mismo estándar.',
      accentWord: 'estándar.',
      lede: 'Leemos los edificios que ya están en pie, también los altos, y revisamos los diseños de otros antes de que se emitan — en cualquier punto de Florida. Cada servicio tiene su propia página.',
      legend: {
        existing: { k: 'Edificios existentes', v: 'Inspección, evaluación y diseño de reparaciones para edificios ya en pie.' },
        new: { k: 'Revisión de diseño', v: 'La revisión independiente por pares de un diseño estructural antes de emitirlo.' },
      },
      all: 'Todos los servicios',
      lines: {
        'structural-condition-assessments': 'Lo que hoy le ocurre al edificio y las reparaciones que necesita. Hallazgos que una junta puede leer, y reparaciones dibujadas para permitirse y construirse.',
        'building-recertification': 'Inspecciones e informes para el programa de recertificación del Condado de Miami-Dade. Estructural y eléctrica, en los formularios del condado, desde la primera visita hasta el informe presentado.',
        'threshold-inspections': 'Las inspecciones del condado para un edificio de más de tres pisos o cincuenta pies, con el informe más completo que su tamaño exige y la calificación estructural que lo respalda.',
        'broward-bsip': 'Inspecciones e informes para el programa de seguridad de edificios del Condado de Broward. Estructural y eléctrica, presentadas en los formularios propios del condado y seguidas hasta que el expediente cierra.',
        'peer-review': 'Una segunda lectura independiente de un diseño estructural. Un registro de comentarios, con seguimiento hasta cerrar cada uno, y un informe que un prestamista puede leer.',
        'milestone-inspections': 'Inspecciones de seguridad estructural bajo la ley de hitos (milestone) de Florida y más allá. Qué reglas alcanzan al edificio, qué encuentra la inspección y qué hacer con ello.',
      },
    },
    statement: {
      lines: ['Inspeccionamos.', 'Evaluamos.', 'Revisamos.'],
      dim: 'Edificios existentes, entre ellos los edificios threshold, y los diseños de otros, en toda Florida — y lo dejamos todo por escrito para que una junta, un propietario y un oficial de construcción puedan seguirlo.',
      accentWord: 'todo',
    },
    types: {
      label: 'Tipos de edificio',
      title: 'De una vivienda unifamiliar a un edificio de mediana altura en concreto.',
      accentWord: 'mediana altura',
      region: 'Tipos de edificio que inspeccionamos',
      sixth: { title: 'Diseño de reparaciones para estructuras existentes' },
    },
    credentials: {
      label: 'Credenciales',
      title: 'Con licencia del Estado de Florida.',
      accentWord: 'Florida.',
      body: 'Respaldamos con firmeza los principios de la licencia profesional de ingeniería y sostenemos nuestra práctica con los más altos estándares éticos. Con licencias de Ingeniería Profesional (PE) de nuestro equipo en ingeniería civil, estructural y eléctrica, todas emitidas por la Junta de Ingenieros Profesionales de Florida, y entre ellas un Ingeniero Estructural Reconocido por la Junta de Florida, llevamos ese estándar a edificios de todo el Estado de Florida.',
      rows: [{ name: 'Ingeniería civil' }, { name: 'Ingeniería estructural' }, { name: 'Ingeniería eléctrica' }],
    },
    contact: {
      label: 'Contacto',
      title: 'Contáctenos.',
      accentWord: 'Contáctenos.',
      sub: 'Cuéntenos sobre el edificio y lo que necesita de nosotros. Escríbanos en inglés o en español.',
      call: 'Llamar',
      whatsapp: 'WhatsApp',
      email: 'Correo',
      where: 'Dónde',
      whereValue: 'En toda Florida',
    },
  },

  services,

  contactServiceOptions: [
    ...services.map((s) => s.shortTitle),
    'Otro / aún no estoy seguro',
  ],

  /* The grid's own headline, a question — see the EN comment. The home
     page keeps "De una vivienda unifamiliar…", on `home.types`. */
  typologiesSection: {
    eyebrow: 'Qué inspeccionamos',
    title: '¿Inspeccionamos su tipo de edificio?',
    accentWord: 'su tipo',
    lede: 'El mismo ingeniero y el mismo estándar de inspección, a la escala del edificio que tenemos enfrente. Si su edificio no está en esta lista, vale más una conversación que una suposición.',
  },

  typologies: [
    { n: '01', title: 'Viviendas unifamiliares', lede: 'Losas agrietadas, zapatas asentadas, daños de tormenta o una compra a la vista: la casa leída como estructura, con las reparaciones que necesita y nada que no.', track: 'existing', href: '/services/structural-condition-assessments', photo: photo.houseConcreteGarden },
    { n: '02', title: 'Townhouses y dúplex', lede: 'Muros medianeros, cimentaciones compartidas y crujías repetidas: un defecto en una crujía se lee contra las demás, y la reparación se define una vez y se cotiza una vez.', track: 'existing', href: '/services/structural-condition-assessments', photo: photo.houseTownhouses },
    { n: '03', title: 'Concreto reforzado de mediana altura', lede: 'Losas planas, núcleos de muros de corte y balcones en voladizo, el sistema con el que se construye el Sur de Florida: inspeccionado para el condado, para la ley de hitos y para la junta que tiene que decidir.', track: 'existing', href: '/services/milestone-inspections', photo: photo.frameCurvedBalconies },
    { n: '04', title: 'Estructuras comerciales y de uso mixto', lede: 'Luces largas sobre el comercio de planta baja, estructura de transferencia donde cambia la retícula, estacionamiento debajo: evaluadas como un solo camino de cargas, con los hallazgos en el orden en que importan.', track: 'existing', href: '/services/structural-condition-assessments', photo: photo.frameCraneClean },
    { n: '05', title: 'Edificios threshold', lede: 'Más de tres pisos o cincuenta pies: los mismos programas del condado, pero un expediente más completo — un ingeniero estructural con la especialización del estado, una carta de autocalificación y la fachada acristalada también revisada.', track: 'existing', href: '/services/threshold-inspections', photo: photo.recertMiamiDade },
    { n: '06', title: 'Reparaciones de estructuras existentes', lede: 'Balcones, fachadas, losas y columnas con décadas en servicio — condición documentada, reparaciones diseñadas, y la documentación que pide el condado.', track: 'existing', href: '/existing-buildings', photo: photo.repairSoffitTrowel },
  ],

  howWeWork: {
    eyebrow: 'Cómo trabajamos',
    title: 'Cinco pasos. Usted siempre sabe en cuál está.',
    lede: 'La secuencia es la misma tanto si responde a una notificación del condado por un edificio de tres pisos o por una torre, como si envía un diseño a revisión. Lo que cambia es la profundidad del paso tres.',
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
        title: 'Evaluación o revisión',
        youDo: 'Dé acceso al sitio, o envíe los planos y responda las preguntas del ingeniero a medida que surjan.',
        youGet: 'Inspección y hallazgos para edificios existentes, con el informe más completo que necesita un edificio threshold; una lectura independiente de un diseño en revisión — con las preguntas planteadas a medida que surgen, no guardadas para el final.',
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
    /* 01 names both county programs; 02 and 03 are two situations of the
       assessments page; 04 is the state's milestone inspection as a profile
       of its own — see the comment over `engagements` in site.ts, which
       also says what `need` may and may not say. */
    { n: '01', title: 'Recertificación o inspección BSIP de un condominio', need: 'Su edificio debe pasar la inspección del condado, o el plazo ya venció. Todavía se puede resolver.', start: 'Para empezar, basta con una foto de la notificación del condado, aunque ya haya pasado su fecha.', projectType: 'Edificio existente — programa del condado', location: 'Miami-Dade o Broward', scope: 'Revisión de la notificación, inspección estructural y eléctrica, informes en los formularios oficiales, alcance de reparaciones, reinspección', structuralSystem: 'Estructura de concreto reforzado con balcones en voladizo', deliverables: 'El paquete completo que pide el condado, en sus formularios oficiales · Registro fotográfico · Alcance de reparaciones' },
    { n: '02', title: 'Inspección de seguridad estructural', need: 'Grietas, manchas de óxido o concreto que se desprende, y necesita saber qué tan grave es.', start: 'Para empezar, bastan unas fotos de las grietas, las manchas o el concreto suelto.', projectType: 'Edificio existente — inspección de seguridad', location: 'Miami-Dade o Broward', scope: 'Inspección estructural visual, mapeo de deterioro del concreto, hallazgos priorizados', structuralSystem: 'Estructura de concreto reforzado, losas postensadas', deliverables: 'Informe de inspección · Mapeo de deterioro · Alcance de seguimiento' },
    { n: '03', title: 'Diseño de reparación tras una inspección', need: 'Una inspección encontró daños, y las reparaciones necesitan planos que un contratista pueda cotizar y el condado pueda permitir.', start: 'Para empezar, basta el informe de la inspección, sea nuestro o de otro ingeniero.', projectType: 'Edificio existente — diseño de reparación', location: 'Miami-Dade o Broward', scope: 'Hallazgos confirmados en sitio, diseño de la reparación del concreto y del refuerzo, planos firmados y sellados para el permiso, respuestas a los comentarios del revisor, visitas durante la obra', structuralSystem: 'Estructura de concreto reforzado, balcones y losas con deterioro', deliverables: 'Planos de reparación firmados y sellados · Especificaciones · Cartas de cierre' },
    { n: '04', title: 'Inspección de hito (milestone) de un condominio', need: 'Su asociación de condominio o cooperativa debe documentar la inspección de hito del estado, y la junta quiere un solo ingeniero que la lleve desde la primera visita hasta el informe presentado.', start: 'Para empezar, bastan el año en que se terminó el edificio y el nombre de la asociación.', projectType: 'Edificio existente — inspección de hito', location: 'Miami-Dade o Broward', scope: 'Inspección visual de fase uno, fase dos cuando la primera lo exige, el informe a la asociación y al oficial de construcción, alcance de reparaciones', structuralSystem: 'Estructura de concreto reforzado con balcones en voladizo y losas postensadas', deliverables: 'Informe de fase uno · Informe de fase dos cuando se requiere · Alcance de reparaciones' },
    { n: '05', title: 'Inspección del condado de un edificio threshold', need: 'Su edificio tiene más de tres pisos o cincuenta pies, y el programa del condado le pide a su informe más que al de un edificio menor.', start: 'Para empezar, basta la notificación del condado, o la dirección y el número de pisos.', projectType: 'Edificio existente — threshold', location: 'Miami-Dade o Broward', scope: 'Qué programa e informe debe el edificio, inspección estructural y eléctrica, el informe estructural con su carta de autocalificación, fachada y acristalamiento estructural donde aplican, alcance de reparaciones', structuralSystem: 'Estructura de concreto reforzado de más de tres pisos, losas postensadas', deliverables: 'El paquete del condado para un edificio threshold · Carta de autocalificación · Alcance de reparaciones' },
    { n: '06', title: 'Revisión estructural independiente por pares', need: 'Un diseño necesita una segunda revisión independiente antes del permiso o de la obra.', start: 'Para empezar, bastan los planos y cálculos que se van a revisar.', projectType: 'Revisión de diseño — terceros', location: 'Miami-Dade o Broward', scope: 'Revisión independiente de planos y cálculos, registro de comentarios, seguimiento hasta el cierre', structuralSystem: 'Concreto reforzado y acero estructural, sistema mixto', deliverables: 'Informe de revisión · Registro de comentarios priorizados · Registro de resolución' },
  ],

  /* No footnote and no gallery lede: see `workSection` in site.ts. */
  workSection: {
    eyebrowReal: 'Trabajos seleccionados',
    galleryEyebrow: 'El material',
  },

  leadership: {
    name: 'Juan Tercero, PE., M.Sc.',
    firstName: 'Juan',
    role: 'Ingeniero Estructural',
    credential: 'Ingeniero Profesional (P.E.) con licencia en Florida',
    portrait: {
      src: '/ttc/img/leadership/juan-tercero.jpg',
      alt: 'Juan Tercero, PE., M.Sc., con traje oscuro y corbata',
      w: 800,
      h: 814,
    },
    license: {
      number: 'PE 105256',
      url: 'https://www.myfloridalicense.com/wl11.asp?mode=0&SID=&brd=&typ=',
    },
    linkedin: null,
    bio: [
      /* The Master's keeps the program's own name ("…en Construction Project
         Management"). No university is named anywhere (the owner, 2026-10-24). */
      'Juan Tercero es Ingeniero Profesional (P.E.) con licencia en Florida en Tercero Tablada Civil and Structural Engineering Inc. Ingeniero civil de formación con un Máster en Construction Project Management, trabaja con un propietario, una junta directiva o un arquitecto desde la primera conversación hasta el juego de planos sellado o el informe presentado.',
    ],
    focus: [
      'Recertificación en Miami-Dade, inspecciones del BSIP en Broward y evaluaciones de condición',
      'Diseño en concreto reforzado para casas, edificios de mediana altura y edificios comerciales',
      'Modelos estructurales en 3D, coordinados con la arquitectura y las instalaciones',
      'Diseño para vientos de huracán en la Zona de Huracanes de Alta Velocidad (Miami-Dade y Broward)',
    ],
    approach:
      'Prefiero explicar una decisión estructural en lenguaje claro antes que esconderla detrás de una referencia de código. Una junta directiva debe poder leer un informe de hallazgos y saber qué hacer a continuación; un contratista debe poder construir desde el plano sin llamar; y un revisor debe poder seguir el cálculo desde la carga hasta el detalle.',
    forYou: [
      { k: 'Comunicación directa', v: 'Usted habla con el ingeniero que está haciendo el trabajo — no con un ejecutivo de cuentas que transmite preguntas.' },
      { k: 'Una propuesta que se entiende', v: 'Cada propuesta establece qué se incluye, qué no, qué recibe y cuánto cuesta, antes de que empiece cualquier cosa.' },
      { k: 'El criterio de un solo ingeniero', v: 'El ingeniero que estudia su edificio o fija la base de diseño es quien responde por el resultado, ante usted y ante el revisor.' },
    ],
  },

  /* La empresa con la que se hacen las recertificaciones. Mismas reglas que
     en site.ts: un solo equipo (sin la frase "empresa aparte"; "aliada" solo
     junto al logo, en la tarjeta de la portada), sin reparto de tareas impreso
     y sin decir quién firma qué informe (decisión del dueño, 2026-10-06).
     "Más de 30 años de experiencia combinada" son las dos empresas juntas,
     nunca el ingeniero solo. */
  partner: {
    eyebrow: 'Con quién trabajamos',
    /* La frase del propietario (2026-10-24), en dos: la página de inicio
       presenta a la firma y no habla de recertificación. "Combinada" y
       "dos empresas" van en el mismo aliento. */
    licensesLabel: 'Licencias de Florida',
    engineering: {
      role: 'Ingeniería estructural',
      licenseLabel: 'Ingeniero Profesional',
      registryLabel: 'Empresa de Ingeniería',
      licensed: 'Con licencia',
      registered: 'Registrada',
    },
    construction: {
      role: 'Empresa aliada · Contratista general y eléctrico',
      name: 'Precision Source Inc.',
      place: 'Miami, Florida',
      logo: { src: '/ttc/img/partners/precision-source.png', w: 640, h: 935 },
      licenses: [
        { label: 'Contratista General Certificado', number: 'CGC061867' },
        { label: 'Contratista Eléctrico Certificado', number: 'EC13010175' },
      ],
    },
    /* El bloque completo va solo en la página de inicio. /about y
       /existing-buildings llevan cada una su versión corta, con sus propias
       palabras y las mismas reglas — ver el comentario en site.ts. */
    about: {
      title: 'Dos empresas, cada una con su propia licencia.',
      body: 'En las recertificaciones de Miami-Dade y en las inspecciones BSIP de Broward trabajamos como un solo equipo con Precision Source Inc., un contratista general y eléctrico certificado en Florida, con sede en Miami. Juntas, las dos empresas reúnen más de 30 años de experiencia combinada. Los dos números de licencia del contratista, abajo, abren la búsqueda de licencias del estado, donde usted mismo puede comprobarlos.',
    },
    brief: {
      title: 'Dos empresas con licencia, un solo equipo.',
      body: 'Desde la notificación hasta el cierre usted trata con un solo equipo: esta firma y Precision Source Inc., un contratista general y eléctrico certificado en Florida, con sede en Miami, que trabaja con nosotros en las recertificaciones y en las inspecciones BSIP. Entre las dos empresas suman más de 30 años de experiencia combinada.',
      link: { href: '/about#contractor', label: 'Las dos empresas y sus licencias' },
    },
  },
  /* Las formas de contactar al ingeniero sin llenar el formulario. Los dos
     datos que dio el propietario el 6 de octubre de 2026 (la propuesta es
     gratis y normalmente se responde en menos de dos horas) cierran
     `closingCta.body`; `reply` sigue siendo el de /contact. "Normalmente":
     no convertirlo en promesa. */
  reach: {
    label: 'Contactar al ingeniero',
    call: 'Llamar',
    whatsapp: 'WhatsApp',
    whatsappNotice: 'Enviar la notificación por WhatsApp',
    form: 'Enviar la notificación',
    whatsappText: 'Hola, recibí una notificación de inspección de mi edificio.',
    whatsappPlain: 'Escríbanos por WhatsApp',
    whatsappTextPlain: 'Hola, quisiera una propuesta para un proyecto.',
    formPlain: 'Propuesta gratis',
    /* Mirror of `formHome` and `whatsappTextHome` in site.ts. */
    formHome: 'Contáctenos',
    whatsappTextHome: 'Hola, quisiera hablar sobre un edificio.',
    reply: 'Normalmente respondemos en menos de dos horas.',
  },

  /* The H1 of these four pages names what the page is about and where, and
     the line each one used to open with now opens `sub`, word for word —
     see the EN comment on `aboutPage` in site.ts. `accentWord` stays one
     short phrase (it does not wrap), and is never the two counties. */
  aboutPage: {
    eyebrow: 'Sobre la firma',
    titleLines: ['Tercero Tablada Civil and Structural', 'Engineering Inc., en el Sur de Florida.'],
    accentWord: 'Sur de Florida.',
    sub: 'Construida alrededor de un solo equipo responsable. Tercero Tablada Civil and Structural Engineering Inc. inspecciona y evalúa los edificios que ya están en pie, entre ellos los edificios threshold, y revisa los diseños de otros, en toda Florida.',
    approach: {
      eyebrow: 'Enfoque',
      title: 'Revisado línea por línea, antes de salir.',
      body: [
        'Por esta firma pasan dos tipos de trabajo, y cada uno enriquece al otro. Leer los diseños de otros enseña qué falla sobre el papel; inspeccionar edificios que llevan décadas en pie enseña qué buscar la próxima vez.',
        'En edificios existentes el trabajo empieza en campo: el edificio se revisa en sitio antes de analizarse, y nada se concluye a partir de un plano que no se haya confirmado allí.',
      ],
    },
    principles: {
      eyebrow: 'Principios',
      items: [
        { k: 'Rigor', v: 'Cada viga, columna y losa se analiza y se verifica según el código aplicable antes de llegar a un plano.' },
        { k: 'Detalles construibles', v: 'Dibujados para construirse en obra: claros para el contratista y en un orden lógico.' },
        { k: 'Coordinación', v: 'La estructura se coordina con la arquitectura y las instalaciones desde el inicio, para que los conflictos se detecten en el modelo y no en sitio.' },
        { k: 'Razonamiento documentado', v: 'Hipótesis, cargas y disposiciones de código quedan escritas, para que cualquier revisor pueda seguir el argumento.' },
        { k: 'Durabilidad', v: 'Diseñado para durabilidad y vida útil en un entorno costero, no solo para el primer día de ocupación.' },
      ],
    },
    team: {
      eyebrow: 'Nuestro equipo',
      title: 'Las personas detrás de su edificio.',
      lede: 'Un solo equipo en el Sur de Florida, desde la notificación hasta el informe final: Juan Tercero y Melvin Tercero en ingeniería estructural, Rudy Diaz en contratación general y eléctrica.',
      members: [
        {
          id: 'engineer',
          name: 'Juan Tercero',
          letters: 'M.Sc.',
          role: 'Ingeniero Civil, P.E.',
          photo: { src: '/ttc/img/leadership/juan-tercero.jpg', alt: 'Juan Tercero, Ingeniero Civil, P.E., M.Sc., con traje oscuro y corbata azul marino', w: 800, h: 814 },
        },
        {
          id: 'melvin',
          name: 'Melvin Tercero',
          letters: 'M.Sc.',
          role: 'Ingeniero en Formación',
          photo: { src: '/ttc/img/leadership/melvin-tercero.jpg', alt: 'Melvin Tercero, Ingeniero en Formación, M.Sc., con traje oscuro y corbata azul marino', w: 800, h: 800 },
        },
        {
          id: 'rudy',
          name: 'Rudy Diaz',
          letters: 'GC, EC, MBA',
          role: 'Contratista General y Eléctrico',
          photo: { src: '/ttc/img/leadership/rudy-diaz.jpg', alt: 'Rudy Diaz, GC, EC, MBA, con traje oscuro y corbata azul marino', w: 800, h: 800 },
        },
      ],
    },
  },

  servicesPage: {
    eyebrow: 'Servicios',
    titleLines: ['Servicios de ingeniería estructural', 'en Miami-Dade y Broward.'],
    accentWord: 'Servicios',
    /* Existing buildings first, as in English: the page opens with them.
       "Ocho" follows the `services` array (four and four). No "how to read
       this page" text and no facts panel (see the English). Keep "servicios
       de ingeniería estructural" whole: it is the only place outside the H1
       that says "ingeniería" (seo.test.ts). */
    sub: 'Organizados por lo que usted necesita, no por lo que hacemos. Seis servicios de ingeniería estructural, para edificios que ya están en pie y para los diseños de los nuevos. La propuesta es gratis.',
    cardMore: 'Detalles',
    tracks: {
      existing: {
        id: 'existing',
        eyebrow: 'Edificios existentes',
        /* "Usted posee" was "you own", word for word. */
        title: 'Usted es dueño de un edificio o lo administra.',
        lede: 'Para asociaciones, administradores de propiedades y propietarios con una notificación del condado, un plazo, deterioro visible o una reparación por definir. ¿Ya pasó el plazo? Todavía tiene solución.',
      },
      new: {
        id: 'new',
        eyebrow: 'Revisión de diseño',
        title: 'Usted está revisando un diseño.',
        lede: 'Para propietarios, desarrolladores, arquitectos y prestamistas con un juego de planos estructurales que debe leerse de forma independiente antes de emitirse.',
      },
    },
  },

  existingPage: {
    eyebrow: 'Edificios existentes',
    /* The old H1 took the place of "…para edificios ya en servicio" in
       `sub`, as in English: the lede is no longer than it was. */
    titleLines: ['Edificios existentes', 'en Miami-Dade y Broward.'],
    accentWord: 'existentes',
    /* Lo que cuesta esperar y la salida, as in English (see the EN comment
       for the sources): no figure, the late reader included, a step that
       costs nothing. */
    sub: 'El edificio ya está en pie. Sin respuesta, una notificación del condado se convierte en multas y un gravamen en Miami-Dade, y en una audiencia de cumplimiento en Broward. ¿Ya va tarde? Todavía tiene solución — envíenos la carta y reciba una propuesta gratis, a precio fijo.',
    /* The hub: four situations, each with the service that answers it — one
       item per existing-building service, in the `services` order. See the
       EN comment in site.ts for what a line may and may not say. Written as
       the reader would say it ("Llegó una notificación…"), not translated.
       No lede, as in English. */
    triggers: {
      eyebrow: 'Cuándo llamar',
      title: 'Cinco situaciones en las que conviene llamar a un ingeniero.',
      items: [
        { slug: 'building-recertification', k: 'Llegó una notificación en Miami-Dade.', v: 'Es la recertificación de edificios de Miami-Dade. Envíenos la carta: entregamos el paquete completo que pide el condado — lo estructural, lo eléctrico y los certificados que los acompañan. La página del programa indica las edades y el plazo que aplican.' },
        { slug: 'broward-bsip', k: 'Llegó una notificación en Broward.', v: 'Es el Programa de Inspección de Seguridad de Edificios, el BSIP, y la carta de su ciudad fija su propia fecha. Partimos de esa carta y entregamos el paquete completo — las inspecciones estructural y eléctrica, el informe escrito y los formularios oficiales del programa.' },
        { slug: 'milestone-inspections', k: 'La junta directiva pregunta si la ley de inspecciones de hito alcanza al edificio.', v: 'La ley estatal y los programas de los condados se superponen. Le decimos qué reglas alcanzan a su edificio y cómo se cumplen en su condado — e inspeccionamos cuando no ha llegado ninguna notificación pero una compra, un prestamista o un deterioro visible dan motivo para revisar.' },
        { slug: 'structural-condition-assessments', k: 'Un informe enumera reparaciones, o algo le preocupa.', v: 'Antes de que los contratistas coticen, un ingeniero dice qué condiciones afectan la estructura y define la reparación, para que todas las ofertas respondan al mismo alcance. La misma evaluación sirve antes de comprar un edificio o de modificarlo.' },
        { slug: 'threshold-inspections', k: 'El edificio tiene más de tres pisos, o el condado devolvió el informe.', v: 'Un edificio threshold responde a los mismos programas del condado con un expediente más completo: un ingeniero estructural con la especialización del estado, una carta de autocalificación y la fachada cuando es acristalamiento estructural. Preparamos ese expediente, para que el informe no vuelva por su calificación.' },
      ],
    },
    /* The one sequence both county programs share — NO age and NO deadline
       here; they are on each county's page. Step order and the six titles
       match the `process` of the two program pages. No links under the
       lede: the county pages are linked from the situations above. See the
       EN comment in site.ts. */
    timeline: {
      eyebrow: 'Recertificación y BSIP',
      title: 'Un camino claro desde la notificación hasta el cierre.',
      lede: 'Miami-Dade lo llama recertificación de edificios; Broward, Programa de Inspección de Seguridad de Edificios. La secuencia es la misma en los dos: usted envía la carta y recibe el paquete completo que pide cada condado.',
      steps: [
        { n: '01', title: 'Revisión de la notificación', detail: 'Leemos la notificación y el registro del edificio, confirmamos qué pide el Building Official y fijamos el calendario en función de la fecha de la carta.' },
        { n: '02', title: 'Inspección', detail: 'Inspección en sitio, estructural y eléctrica — la estructura, las losas, los balcones, el techo y las cimentaciones expuestas, y los sistemas eléctricos del edificio — documentada en campo, con fotografías vinculadas a su ubicación.' },
        { n: '03', title: 'Informe presentado', detail: 'Los informes, el estructural y el eléctrico, se preparan en los formularios oficiales que exige el condado, en un lenguaje con el que la junta directiva puede actuar, y se presentan aunque enumeren reparaciones.' },
        { n: '04', title: 'Reparaciones con permiso', detail: 'Donde se requieran reparaciones definimos qué debe corregirse y con qué estándar, para que el trabajo pueda cotizarse en igualdad de condiciones. La obra que requiere permiso espera a tenerlo.' },
        /* Its own sentence — see the EN step. */
        { n: '05', title: 'Reinspección', detail: 'Cuando la obra termina, volvemos a las áreas reparadas y las comparamos con lo que encontró el primer informe.' },
        { n: '06', title: 'Cierre', detail: 'Un informe enmendado — en Broward, con una carta de finalización firmada y sellada — indica que las reparaciones están completas. El expediente queda cerrado hasta el siguiente ciclo.' },
      ],
    },
  },

  workPage: {
    eyebrowReal: 'Trabajos seleccionados',
    /* "Típicos" in the H1 as in the nav label and the title, and no place:
       with "Sur de Florida" here and in the title, this page competed with
       the home page for it. See the EN comment in site.ts. */
    titleLines: ['Trabajos típicos de ingeniería estructural', 'por tipo de proyecto.'],
    accentWord: 'típicos',
    subReal: 'La estructura detrás del proyecto. Trabajos de ingeniería estructural en el Sur de Florida — el edificio, el problema, el alcance, nuestro rol y el resultado documentado.',
    subRepresentative:
      'La estructura detrás del proyecto. Cada tipo de trabajo de ingeniería que realiza la firma en el Sur de Florida, con su alcance, su sistema estructural y sus documentos — trabajos típicos, no proyectos anteriores concretos.',
    facts: [
      { k: 'Cobertura', v: 'Miami-Dade y Broward' },
      { k: 'Sistemas', v: 'Concreto reforzado, acero' },
    ],
  },

  /* The H1 of /es/contact, and — in `closingCta` — the headline that closes
     every page. It was "Respondemos con un alcance.", "we reply with a
     scope" word for word: no building owner asks for "un alcance". What he
     gets is a proposal, and the page under this headline already says so.
     "Le enviamos", not "(Le) respondemos con": measured in the H1, the
     longer verb takes a fifth line on a 320px screen and "…una propuesta
     clara" a fifth up to 390px, where the old headline took four — and on
     the form opened for a notice a taller H1 pushes the upload further down
     the first screen. This one is four lines at every phone width. */
  contactPage: {
    eyebrow: 'Solicitar propuesta',
    titleLines: ['Cuéntenos de su edificio.', 'Le enviamos una propuesta.'],
    accentWord: 'propuesta.',
    /* Mirror of `sub` in site.ts: what waiting costs, the easy step, the
       free fixed-fee proposal, then the late arrivals. */
    sub: 'Una notificación sin respuesta solo se agrava. Envíela hoy — basta una foto de la carta tomada con el teléfono — y reciba una propuesta gratis y a precio fijo. ¿Ya va tarde? Todavía tiene solución.',
    /* Mirror of `subNew` in site.ts: the line for a new-building ?service=,
       with no notice, no fixed fee and no reply time. */
    subNew: 'Envíe los planos, o unas líneas sobre el proyecto y dónde está — lo que ya tenga — y reciba una propuesta gratis con el alcance por escrito.',
    /* Mirror of `before` in site.ts: the guide beside the form, written for
       someone about to write. "Carta", the word the buttons and the form use
       for the notice. No number, no phone number, no amount — see the EN
       comment. The H1's "Cuéntenos" and "enviamos" are here (seo.test.ts).
       "Building Official" carries its gloss at its first use on the page
       (the row for a date already passed), the short form after it. */
    before: {
      eyebrow: 'Cómo funciona',
      title: 'Qué enviar y qué pasa después.',
      items: [
        { k: 'Si ya tiene la carta', v: 'Para empezar basta una foto de la carta tomada con el teléfono. Adjúntela en este formulario o envíela por WhatsApp; no hace falta escanearla ni copiar lo que dice. Si la carta tiene varias páginas, tómele una foto a cada una. Lo primero que buscamos es qué oficina la envió y qué fechas indica.' },
        { k: 'Si la fecha ya pasó', v: 'Escríbanos de todos modos y adjunte la carta junto con cualquier aviso o citación que haya llegado después. La inspección todavía puede hacerse y el informe presentarse; cuanto antes lea el ingeniero lo que recibió, antes tendrá usted un plan que presentar a su Building Official (el funcionario de construcción).' },
        { k: 'Si todavía no le ha llegado', v: 'Envíe la dirección del edificio y un dato: en Miami-Dade, el año de construcción; en Broward, el año del certificado de ocupación. Cada condado cuenta la antigüedad del edificio a partir de ese registro, y con él podemos decirle qué le corresponde al suyo antes de que llegue la carta.' },
        { k: 'Para cualquier otro edificio o proyecto', v: 'Cuéntenos del edificio, dónde está y qué necesita: una evaluación, el diseño de una reparación, la inspección del condado de un edificio threshold o una segunda revisión de un diseño hecho por otros. Los planos, las fotografías y los informes anteriores son bienvenidos, y ninguno es obligatorio. La propuesta para este trabajo también es gratis.' },
        { k: 'Para un edificio de más de tres pisos', v: 'Díganos también el número de pisos o la altura. Pasados los tres pisos, o los cincuenta pies de altura, el condado le pide más al informe — un ingeniero con la especialización estructural que reconoce el estado, y una carta que lo acredite — y la propuesta tiene que contemplarlo desde el principio.' },
        { k: 'Si escribe en nombre de una junta o una asociación', v: 'Una sola persona puede escribir por toda la junta. Enviamos la propuesta en una forma que pueda compartirse con los directores, y respondemos sus preguntas en una llamada si eso ayuda a la votación.' },
        { k: 'Después de enviarlo', v: 'Si hay una carta, el ingeniero lee primero lo que pide su Building Official. Después le enviamos preguntas o una propuesta escrita con el alcance: qué incluye el trabajo, qué queda fuera, qué recibe usted y cuánto cuesta — en una recertificación o un BSIP, un precio fijo. Nada comienza hasta que usted la acepte.' },
        { k: 'Dónde y en qué idioma', v: 'Trabajamos en Miami-Dade y Broward, en todas las ciudades de ambos condados: de Miami, Hialeah y Coral Gables a Fort Lauderdale, Hollywood y Pompano Beach. Indíquenos la ciudad, o si el edificio está fuera de los límites de una ciudad: de eso depende qué oficina envía la carta y recibe el informe. El formulario y este sitio están en español y en inglés; escríbanos en el idioma que le resulte más cómodo.' },
      ],
    },
  },

  closingCta: {
    eyebrow: 'Siguiente paso',
    titleLines: ['Cuéntenos de su edificio.', 'Le enviamos una propuesta.'],
    accentWord: 'propuesta.',
    /* Leads with the notice, as in English: notice, existing building, new
       project. It ends on the two facts that were the small line under the
       buttons (see the EN comment). */
    body: 'Una notificación del condado en la mano, un edificio que le preocupa o un proyecto nuevo — descríbalo y adjunte lo que tenga. Basta una foto de la carta tomada con el teléfono. El ingeniero le responde, normalmente en menos de dos horas, con preguntas o con una propuesta gratis por escrito.',
    primary: { href: '/contact', label: 'Solicitar propuesta' },
    secondary: { href: '/about#team', label: 'Conozca al equipo' },
  },

  pricing: {
    eyebrow: 'Precio fijo',
    titleLines: ['Conozca el costo', 'antes de comprometerse.'],
    accentWord: 'antes de comprometerse.',
    lede: 'Cada reporte de recertificación y de BSIP se cotiza a precio fijo antes de empezar. La mayoría de los edificios cae en estos rangos según su tamaño; su cifra fija consta en su propuesta. Orientativo, no es una oferta.',
    programs: [
      {
        id: 'price-miami-dade',
        slug: 'building-recertification',
        name: 'Recertificación de Miami-Dade',
        tiers: [
          { size: 'Edificio comercial o multifamiliar pequeño', price: 'Desde $2,500' },
          { size: '3–10 unidades, o un edificio comercial comparable', price: '$3,500 – $5,500' },
          { size: '11–40 unidades, o una propiedad con varios edificios', price: '$5,500 – $9,500' },
          { size: 'Propiedad grande o compleja', price: 'Propuesta a medida' },
        ],
      },
      {
        id: 'price-broward',
        slug: 'broward-bsip',
        name: 'BSIP de Broward',
        tiers: [
          { size: 'Edificio comercial o multifamiliar pequeño', price: 'Desde $2,000' },
          { size: '3–10 unidades, o un edificio comercial comparable', price: '$3,000 – $5,000' },
          { size: '11–40 unidades, o una propiedad con varios edificios', price: '$5,000 – $9,000' },
          { size: 'Propiedad grande o compleja', price: 'Propuesta a medida' },
        ],
      },
    ],
    includesTitle: 'Dentro del precio fijo',
    includes: [
      'Inspección estructural y eléctrica del edificio.',
      'El reporte estructural, firmado y sellado, y el reporte eléctrico.',
      'La presentación ante el condado y nuestras respuestas a los comentarios de revisión de esa inspección.',
    ],
    note: 'El precio depende del tamaño del edificio, del número de estructuras, del servicio eléctrico, de los documentos disponibles y de lo que pida la jurisdicción. Varios edificios: una sola propuesta, con un precio para cada uno.',
    sizeLabel: 'Tamaño del edificio',
    cta: 'Solicitar propuesta a precio fijo',
    costLink: 'Qué mueve el precio y qué queda fuera de los honorarios',
    pageLink: 'Precios según el tamaño del edificio: {name}',
    delivery: 'El paquete completo, firmado y sellado, de tres a cuatro días después de la inspección. ¿Tiene prisa? De uno a dos días.',
    jurisdictions: {
      /* Every municipality is named in plain text under its county's name.
         No county or city logo is shown (the owner, 2026-10-25). */
      lists: [
        { title: 'Condado de Miami-Dade', names: miamiDadeMunicipalities },
        { title: 'Condado de Broward', names: browardMunicipalities },
      ],
    },
  },
  legal: {
    calcNotice: {
      text: 'Una ayuda de trabajo, no un diseño, opinión de ingeniería ni documento sellado. Sin garantía: compruebe cada resultado por su cuenta.',
      link: 'Términos de uso',
    },
    links: [
      { href: '/privacy', label: 'Política de privacidad' },
      { href: '/terms', label: 'Términos de uso' },
      { href: '/credits', label: 'Créditos de imágenes' },
    ],
    /* `title` is the short name (breadcrumb, section label, footer); `h1`
       says what the policy covers. A section's `p` is one paragraph or a
       list of them, and `contact` leads to the e-mail address under
       "Contacto". See the EN comment in site.ts — above all what may be
       written here (only what the code does) and what may not (anything
       that is the owner's legal decision). As in English, Google Ads
       measurement swaps the opening of "Qué recopilamos" and the heading
       and first paragraph of "Cookies y analítica" for `privacyAds`, above,
       on the same flag that prints the script. */
    privacy: {
      title: 'Política de privacidad',
      h1: 'Política de privacidad de este sitio web',
      updated: 'Última actualización: 20 de octubre de 2026',
      sub: 'Qué recopilamos a través de este sitio web, por qué lo recopilamos y qué hacemos con ello.',
      sections: [
        { h: 'Qué recopilamos', p: [
          `${ADS.on ? privacyAds.collect : 'La'} única información personal que recopila este sitio web es la que usted envía a través del formulario de solicitud de propuesta: su nombre, correo electrónico, teléfono opcional, el servicio seleccionado, la dirección del edificio o la ubicación del proyecto, la descripción que escribe y los archivos que adjunta. Junto con la solicitud registramos también la página de este sitio por la que entró y la dirección de la página que enlazó hacia él, para saber cómo nos encuentran.`,
          'El formulario no pide datos de pago, números de identificación personal (por ejemplo, el del Seguro Social o el de la licencia de conducir) ni contraseñas, y una propuesta no los necesita. Le pedimos que no los incluya en la descripción ni en los archivos que adjunte.',
        ] },
        { h: 'Por qué la recopilamos', p: 'La usamos para responder a su solicitud y para entender el alcance de ingeniería sobre el que pregunta. No la vendemos, alquilamos ni compartimos con fines publicitarios.' },
        { h: 'Cómo se almacena', p: [
          'Las solicitudes se guardan en nuestra base de datos de proyectos y los adjuntos en almacenamiento de archivos en la nube, en una dirección que nunca se publica ni se enlaza; se envía una notificación por correo electrónico a la oficina a través de un proveedor de correo transaccional para que veamos su mensaje, y se le envía una confirmación a usted. El acceso se limita a las personas que lo necesitan para responderle.',
          'El correo que recibe nuestra oficina contiene el texto de su solicitud y un enlace a cada archivo, no los archivos mismos. La confirmación que usted recibe indica una referencia y el servicio que eligió; nunca repite lo que usted escribió.',
          'Para evitar el abuso del formulario, el servidor cuenta cuántas solicitudes llegan desde una misma dirección de internet (IP) en un periodo corto. Ese conteo se mantiene en memoria y no se guarda con su solicitud. La conexión con este sitio está cifrada (HTTPS).',
        ] },
        /* Accurate to CONTACT_BLOB_ACCESS = 'public': the address is secret,
           not locked. See the EN comment. */
        { h: 'Los archivos que adjunta', p: 'Un archivo se sube en el momento en que usted lo agrega al formulario, antes de enviar la solicitud, y va directamente de su navegador al proveedor de almacenamiento. Se guarda en una dirección larga y aleatoria que no se publica ni se enlaza en ninguna parte. Quien tenga esa dirección puede abrir el archivo, por lo que no la damos a conocer: la oficina abre los adjuntos desde su propia bandeja, con sesión iniciada. Si usted quita un archivo, o sale de la página sin enviar, la copia ya subida no queda unida a ninguna solicitud; escríbanos si desea que la eliminemos.' },
        { h: 'Cuánto tiempo la conservamos', p: 'Las solicitudes se conservan mientras sean comercialmente relevantes y durante el tiempo que requiera cualquier encargo resultante. Puede pedirnos que eliminemos su solicitud y sus adjuntos en cualquier momento. Cuando se elimina una solicitud, sus archivos adjuntos se eliminan del almacenamiento junto con ella.' },
        /* The heading and the first paragraph change with Google Ads
           measurement (`privacyAds`, above); the other two are true either
           way. */
        { h: ADS.on ? privacyAds.h : 'Cookies y analítica', p: [
          ...(ADS.on ? privacyAds.p : [
            'Las páginas públicas de este sitio no instalan cookies ni ejecutan scripts de analítica, de publicidad o de redes sociales. Sus scripts, tipografías, fotografías y videos se sirven desde la propia dirección de este sitio, y el formulario no usa ningún servicio externo de verificación (CAPTCHA).',
          ]),
          'Una sola preferencia se guarda en su navegador y nunca se nos envía: si usted pausa el video de fondo o las palabras en movimiento, el sitio lo recuerda para que sigan en pausa en la página siguiente.',
          'El área autenticada de gestión de proyectos de este dominio puede usar cookies para el inicio de sesión; esas son estrictamente necesarias para mantener una sesión activa y no se usan para perfilar a los visitantes del sitio público.',
        ] },
        { h: 'Enlaces que salen de este sitio', p: 'Llamarnos, escribirnos por WhatsApp y seguir un enlace a una oficina del condado, a la búsqueda de licencias del estado o a otra fuente oficial son cosas que ocurren fuera de este sitio web. Lo que usted envíe o haga allí lo gestiona ese servicio conforme a sus propias condiciones de privacidad, que no controlamos. El enlace de WhatsApp abre un chat con una primera línea ya escrita; nada se envía hasta que usted lo envíe.' },
        { h: 'Calculadoras', p: 'Las calculadoras de Recursos hacen su trabajo en su navegador. Los valores que usted introduce no se nos envían ni los guardamos. La calculadora los conserva en la dirección de la página, después del signo #, que es la parte de una dirección que el navegador no envía: así una recarga, o un enlace que usted copie, abre el mismo caso. Quien reciba ese enlace ve los valores que contiene.' },
        { h: 'Sus opciones', p: 'Puede preguntarnos qué información tenemos sobre usted, pedir que se corrija o pedir que se elimine. Escriba a la dirección indicada abajo y le responderemos. Indíquenos el correo electrónico que usó en el formulario y, si la conserva, la referencia de la confirmación: así encontramos su solicitud.' },
        { h: 'Menores de edad', p: 'Este sitio web no está dirigido a menores de trece años y no recopilamos a sabiendas información de ellos. Si cree que un menor nos envió una solicitud, escriba a la dirección que aparece abajo y la eliminaremos.' },
        { h: 'Cambios', p: 'Si esta política cambia, la actualizaremos en esta página.' },
      ],
      contact: 'Las preguntas sobre esta política, o una solicitud sobre su propia información, se dirigen a',
    },
    terms: {
      title: 'Términos de uso',
      h1: 'Términos de uso de este sitio web',
      sub: 'La base sobre la que se ofrece la información publicada aquí.',
      sections: [
        { h: 'Información general únicamente', p: 'El contenido de este sitio web describe servicios en términos generales, y sus calculadoras son herramientas de trabajo. Nada de ello es una opinión de ingeniería, una recomendación para un edificio específico ni un sustituto de una evaluación en sitio. Nada de lo aquí publicado debe usarse como base para una decisión de construcción, reparación o cumplimiento.' },
        { h: 'Sin relación profesional', p: [
          'Visitar este sitio, leerlo o enviar el formulario de solicitud de propuesta no crea una relación profesional de ingeniería. Un encargo comienza solo cuando el alcance, los honorarios y los términos se acuerdan por escrito.',
          'Lo mismo vale para una llamada, un correo electrónico o un mensaje de WhatsApp, y para una notificación enviada por cualquiera de esos medios: la leemos y respondemos, y nada está en marcha hasta que usted haya aceptado una propuesta escrita. Pedir una propuesta es gratis y no le compromete a nada.',
        ] },
        { h: 'Notificaciones y plazos', p: 'Enviarnos una notificación no detiene ni amplía el plazo que indica. Una prórroga la concede el Building Official que emitió la notificación, no nosotros. Si algo de este sitio difiere de la carta que usted recibió, guíese por la carta y por la oficina que la envió.' },
        { h: 'Resultados regulatorios', p: 'Los requisitos de inspección, recertificación y permisos varían según la jurisdicción, la edad del edificio, el tipo de construcción y el alcance. Las edades y los plazos publicados aquí fueron verificados en la fecha indicada junto a ellos y pueden cambiar. Cada tabla nombra la oficina o el código de donde provienen sus cifras, para que usted pueda leer la fuente directamente. Las descripciones de cualquier proceso en este sitio son secuencias típicas, no garantías. No prometemos la aprobación de ningún departamento de construcción ni autoridad revisora.' },
        { h: 'Documentos sellados', p: 'Donde se requiera un documento firmado y sellado, se emite como entregable formal bajo un alcance de trabajo acordado. El contenido de este sitio web nunca es un entregable sellado.' },
        { h: 'Exactitud y disponibilidad', p: 'Mantenemos este sitio actualizado, pero no garantizamos que cada afirmación sea completa o esté libre de errores, ni que el sitio esté siempre disponible. El tiempo de respuesta que se menciona en este sitio es el habitual, no un compromiso.' },
        { h: 'Enlaces a otros sitios', p: 'Este sitio enlaza a oficinas de los condados, a la búsqueda de licencias del DBPR de Florida, a leyes y códigos, y a WhatsApp. Esas páginas pertenecen a quien las publica y están fuera de nuestro control: pueden cambiar o trasladarse a otra dirección, y de lo que dicen y de cómo tratan su información responde quien las publica. Las oficinas de construcción de las ciudades se nombran, pero no se enlazan; debajo de cada lista indicamos la fecha en que se revisaron sus nombres por última vez.' },
        { h: 'Fotografías y ejemplos', p: 'Las fotografías y los videos de este sitio son imágenes con licencia que muestran tipos de edificios y de trabajos. Ninguna muestra un proyecto de la firma, y ninguna se eligió porque un edificio que aparece en ella haya recibido una notificación. Los perfiles de Trabajos típicos describen el trabajo que la firma realiza; no son proyectos pasados.' },
        { h: 'Calculadoras', p: 'Las calculadoras de Recursos son herramientas de trabajo para ingenieros y estudiantes. Cada una indica en su propia página el método que usa, lo que supone y lo que deja fuera, y un resultado vale lo que valgan el modelo y los valores introducidos. Compruébelo por medios independientes: una decisión se apoya en esa comprobación, no en la calculadora. Un resultado no es un diseño, ni una opinión de ingeniería, ni un documento sellado, y usar una calculadora no nos convierte en el ingeniero de su proyecto. Se ofrecen tal como son, sin garantía, y la firma no asume ninguna responsabilidad por los resultados que se obtengan con ellas ni por el uso que se haga de esos resultados.' },
        { h: 'Propiedad intelectual', p: 'Los textos, las tablas, el diseño y el código de este sitio, incluidas las calculadoras, y el nombre y el logotipo de la firma pertenecen a Tercero Tablada Civil and Structural Engineering Inc. No pueden copiarse, revenderse ni republicarse sin autorización. Las fotografías, los videos y las marcas de terceros pertenecen a sus respectivos titulares (vea Créditos de imágenes).' },
        { h: 'Archivos que usted envía', p: 'Si adjunta un archivo, usted confirma que puede compartirlo con nosotros. Lo usamos solo para responder a su solicitud y lo conservamos como indica la Política de privacidad. Una solicitud enviada antes de un encargo no es una comunicación confidencial en el sentido legal, así que deje fuera lo que no quiera que leamos: la carta y la dirección bastan para empezar.' },
        { h: 'Rangos de precios', p: 'Los rangos de honorarios que se publican en este sitio web son orientativos y se dan según el tamaño del edificio para que usted pueda planificar. No son una oferta. Un precio fijo obliga solo cuando consta en una propuesta escrita que usted haya aceptado, para el alcance que esa propuesta describe. Un edificio puede quedar fuera de un rango por su tamaño, por el número de estructuras, por su servicio eléctrico o por los documentos disponibles. Las reparaciones, los permisos que requieran y las tasas que cobre un condado o una ciudad no forman parte de un rango, salvo que la propuesta lo indique.' },
        { h: 'Nombres de gobiernos', p: 'Los nombres de condados, ciudades y otras oficinas de gobierno que aparecen en este sitio web pertenecen a esos gobiernos. Se muestran solo para identificar la oficina que envía una notificación, y no se muestra ningún logotipo, sello ni marca de gobierno. Tercero Tablada Civil and Structural Engineering Inc. es una firma independiente. No está afiliada a ninguna oficina de gobierno, no cuenta con su aval ni actúa en su nombre, y nada de este sitio web es una publicación oficial de una de ellas. Si un gobierno pide que se cambie o se retire su nombre, lo haremos.' },
        /* En mayúsculas a propósito, como en inglés: una limitación que pasa
           inadvertida es la que un tribunal deja sin efecto. */
        { h: 'Limitación de responsabilidad', p: [
          'ESTE SITIO WEB, SU CONTENIDO Y SUS CALCULADORAS SE OFRECEN “TAL COMO ESTÁN” Y “SEGÚN DISPONIBILIDAD”, SIN GARANTÍA DE NINGÚN TIPO, EXPRESA NI IMPLÍCITA, INCLUIDA CUALQUIER GARANTÍA DE COMERCIABILIDAD O DE IDONEIDAD PARA UN FIN PARTICULAR. EN LA MÁXIMA MEDIDA QUE PERMITA LA LEY, TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. Y LAS PERSONAS QUE TRABAJAN EN ELLA NO RESPONDEN, YA SEA POR CONTRATO, POR NEGLIGENCIA O DE OTRO MODO, POR NINGUNA PÉRDIDA O DAÑO, DIRECTO O INDIRECTO, INCLUIDO EL LUCRO CESANTE Y LOS DAÑOS CONSECUENTES, QUE SURJA DEL USO DE ESTE SITIO WEB, DE LA INFORMACIÓN, LAS CALCULADORAS Y LOS ENLACES QUE CONTIENE, O DE NO PODER USARLO.',
          'Nada de lo aquí dicho limita una responsabilidad que la ley no permita limitar, y nada de lo aquí dicho cambia lo que disponga, para ese encargo, un contrato de servicios por escrito firmado con usted.',
        ] },
        { h: 'Otras empresas', p: 'Precision Source Inc., el contratista con el que trabajamos, es una empresa independiente, con sus propias licencias. Cada firma contrata y responde por su propio trabajo; ninguna es agente, empleada ni socia de la otra, y nada en este sitio hace que una responda por la otra.' },
        { h: 'Ley aplicable', p: 'Estos términos, y cualquier controversia sobre este sitio web, se rigen por las leyes del Estado de Florida, y los tribunales de Florida tienen jurisdicción sobre ellos.' },
        { h: 'Disposiciones generales', p: [
          'Use este sitio web de forma lícita. No intente interrumpirlo, acceder a partes que no son públicas ni copiarlo de forma masiva con medios automatizados, y no envíe por el formulario nada que sea ilícito, engañoso o dañino. El formulario es para solicitudes reales sobre edificios reales.',
          'Podemos actualizar estos términos. La fecha que aparece al inicio de la página indica la última versión, y usar el sitio web después de un cambio significa que acepta la versión vigente en ese momento.',
          'Si un tribunal considera que una parte de estos términos no es exigible, el resto sigue vigente.',
        ] },
      ],
      contact: 'Las preguntas sobre estos términos se dirigen a',
    },
    contactHeading: 'Contacto',
    updated: 'Última actualización: 21 de octubre de 2026',
    toc: 'En esta página',
  },
};
