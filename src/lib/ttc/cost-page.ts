import type { Lang } from './i18n';

export { COST_PATH } from './cost-path';

/**
 * THE COST PAGE — /services/recertification-cost and its Spanish twin.
 *
 * Built on October 17, 2026 for the searches "40 year recertification cost
 * miami" and "BSIP cost": every site Google ranks for them shows numbers,
 * and this one now does too. The fee ranges themselves are NOT here: they
 * are `pricing.programs` in site.ts / site.es.ts (the owner approved them
 * on October 16, 2026), the same rows the home page prints, read by
 * CostView. This file holds only what the page says around them.
 *
 * Rules, the same as the rest of the site:
 *   • no age, no day count, no deadline — those live in each county's
 *     timing row, next to their authority and their date;
 *   • no county or city fee in figures: each office sets its own, and the
 *     page says to ask that office;
 *   • no promise the firm has not made (the reply time is "usually", the
 *     proposal is free, the fee is fixed in writing — all the owner's own);
 *   • no client, case or review that is not real.
 */
export type CostItem = { k: string; v: string };
/**
 * A factor of the price and, where the owner can do something about it,
 * that one thing (`save`): the cause and its remedy in one row, so each
 * lever is explained once. Two factors have none, and say nothing there.
 */
export type CostFactor = CostItem & { save?: string };
export type CostPage = {
  seo: { title: string; description: string; keywords: string[] };
  crumb: string;
  eyebrow: string;
  titleLines: string[];
  accentWord: string;
  sub: string;
  reviewed: string;
  tables: { label: string; title: string; lede: string; cta: string };
  /** `head` is the first column of the factors table; `save.label` heads the last. */
  factors: { label: string; title: string; lede: string; head: string; items: CostFactor[] };
  /** The right-hand column of the fee's scope, beside "In the fixed fee". */
  outside: { label: string; items: CostItem[]; lateLink: string };
  /** `first`: the one way to pay less that belongs to no factor — when to call. */
  save: { label: string; first: string };
  faq: { label: string; title: string; items: { q: string; a: string }[] };
  programLink: (name: string) => string;
};

const en: CostPage = {
  seo: {
    title: '40-Year Recertification Cost — Miami-Dade & Broward',
    description:
      'Fixed-fee ranges for Miami-Dade recertification and the Broward BSIP by building size, what the fee covers, what is quoted apart and how to pay less.',
    keywords: [
      '40 year recertification cost Miami',
      'building recertification cost Miami-Dade',
      'BSIP inspection cost Broward',
      '40 year inspection price',
      'recertification engineer fee',
      'condo recertification cost',
    ],
  },
  crumb: 'Recertification cost',
  eyebrow: 'Pricing',
  titleLines: ['What a recertification', 'costs in South Florida.'],
  accentWord: 'costs in South Florida.',
  sub: 'Know what you will pay up front: fixed-fee ranges for the Miami-Dade recertification and the Broward BSIP across South Florida, by building size, and the costs outside the engineering fee.',
  reviewed: 'Prices reviewed October 2026',
  tables: {
    label: 'The fee',
    title: 'The engineering fee, by building size.',
    lede: 'One fixed figure, written in the proposal before any work starts: no hourly billing, and no charge for the proposal itself. These are the ranges that figure falls in.',
    cta: 'Ask for your fixed figure',
  },
  factors: {
    label: 'What moves the price',
    title: 'Why two buildings of the same size can cost differently.',
    lede: 'The range is set by size. Where a building falls inside it depends on six things.',
    head: 'Factor',
    items: [
      { k: 'Floors, units and square feet', v: 'They set how long the inspection takes and how long the reports run.' },
      { k: 'Number of structures', v: 'Each building, parking garage or detached structure on the property is inspected and reported on by itself.', save: 'With several buildings, ask for one proposal priced building by building.' },
      { k: 'The electrical service', v: 'A larger service takes longer to inspect, and the county’s rules can call for infrared thermography of the equipment; the proposal says when they do.', save: 'Have one team inspect the structure and the electrical together: one visit, one schedule, one contact.' },
      { k: 'Drawings and earlier reports', v: 'The original drawings and the last recertification report shorten the work. Without them, more is measured and documented on site.', save: 'Send the notice, the original drawings and any earlier report with your request.' },
      { k: 'Access on the day', v: 'Roofs, garages, electrical rooms and units that cannot be opened on the day of the inspection mean a second visit.', save: 'Open every area on one day: roofs, garages, electrical rooms and the units the engineer asks for.' },
      { k: 'The office that sent the notice', v: 'Each city and county office has its own forms and submission steps, and some ask for more than others.' },
    ],
  },
  outside: {
    label: 'Outside the fee',
    items: [
      { k: 'Repairs', v: 'If the inspection finds deficiencies, a contractor prices the repairs once their scope is known, under a building permit. Their cost depends entirely on what is found.' },
      { k: 'Filing and permit fees', v: 'The office that sent the notice charges its own filing and permit fees, and changes them from time to time. Ask that office for its current schedule: the filing step is in our process, its fee is not in our price.' },
      /* Many owners arrive after their date (the owner, 2026-10-20): the
         row that names the cost of waiting must not shut them out. */
      { k: 'Penalties for a late report', v: 'A report that misses its date moves to enforcement, with penalties and costs set by the county or the city: the one cost an early start avoids. Already late? It can still be resolved.' },
    ],
    lateLink: 'What waiting can cost',
  },
  save: {
    label: 'Pay less',
    first: 'Call when the notice arrives, not near its date: there is time to plan repairs instead of rushing them.',
  },
  faq: {
    label: 'Questions',
    title: 'Questions owners ask about the price.',
    items: [
      { q: 'Is the proposal free?', a: 'Yes. Asking for a proposal costs nothing and commits you to nothing. The fee is fixed in writing before any work starts.' },
      { q: 'Is the price fixed, or billed by the hour?', a: 'Fixed. The proposal states one figure for the scope it describes, and that is the fee for that scope.' },
      { q: 'Do the ranges include repairs?', a: 'No. Repairs, the documents they need and their permits are quoted apart, once the inspection has shown what is needed.' },
      { q: 'Are the county or city fees in the price?', a: 'No. The office that sent the notice charges them directly, at the amount it sets. We include the filing step, not the fee.' },
      { q: 'Does a property with several buildings cost more?', a: 'Each structure is inspected and reported on, so the total grows with the number of structures. One proposal prices each building separately.' },
      { q: 'How soon after the inspection do I get the reports?', a: 'The complete package, signed and sealed, is ready three to four days after the inspection. When a deadline is close, it can be ready in one to two days.' },
      { q: 'What do you need to give me a figure?', a: 'A phone photo of the notice is enough to start. The drawings or an earlier report, if you have them, let the figure come closer to the final one.' },
    ],
  },
  programLink: (name) => `${name}: what it includes`,
};

const es: CostPage = {
  seo: {
    title: 'Costo de la recertificación de 40 años — Miami-Dade y Broward',
    description:
      'Rangos de precio fijo de la recertificación en Miami-Dade y del BSIP en Broward por tamaño del edificio, qué incluye, qué va aparte y cómo pagar menos.',
    keywords: [
      'costo recertificación 40 años Miami',
      'precio recertificación de edificios Miami-Dade',
      'costo inspección BSIP Broward',
      'precio inspección 40 años',
      'honorarios ingeniero recertificación',
      'costo recertificación condominio',
    ],
  },
  crumb: 'Costo de la recertificación',
  eyebrow: 'Precios',
  titleLines: ['Lo que cuesta una recertificación', 'en el Sur de Florida.'],
  accentWord: 'en el Sur de Florida.',
  sub: 'Sepa de antemano cuánto va a pagar: rangos de precio fijo de la recertificación de Miami-Dade y del BSIP de Broward en el Sur de Florida, según el tamaño del edificio, y los costos que quedan fuera de los honorarios de ingeniería.',
  reviewed: 'Precios revisados en octubre de 2026',
  tables: {
    label: 'Los honorarios',
    title: 'Los honorarios de ingeniería, según el tamaño del edificio.',
    lede: 'Una sola cifra fija, escrita en la propuesta antes de empezar: sin cobro por hora y sin costo por la propuesta. Estos son los rangos en los que cae esa cifra.',
    cta: 'Pida su cifra fija',
  },
  factors: {
    label: 'Qué mueve el precio',
    title: 'Por qué dos edificios del mismo tamaño pueden costar distinto.',
    lede: 'El rango lo fija el tamaño. Dónde cae un edificio dentro de él depende de seis cosas.',
    head: 'Factor',
    items: [
      { k: 'Pisos, unidades y pies cuadrados', v: 'Determinan cuánto dura la inspección y qué tan extensos son los informes.' },
      { k: 'Número de estructuras', v: 'Cada edificio, garaje o estructura independiente de la propiedad se inspecciona y se informa por separado.', save: 'Si tiene varios edificios, pida una sola propuesta con precio edificio por edificio.' },
      { k: 'El servicio eléctrico', v: 'Un servicio más grande lleva más tiempo de inspección, y las reglas del condado pueden exigir termografía infrarroja de los equipos; la propuesta indica cuándo.', save: 'Que un solo equipo inspeccione la estructura y la parte eléctrica a la vez: una visita, un calendario, un contacto.' },
      { k: 'Planos e informes anteriores', v: 'Los planos originales y el último informe de recertificación acortan el trabajo. Sin ellos, se mide y se documenta más en sitio.', save: 'Envíe la notificación, los planos originales y cualquier informe anterior junto con su solicitud.' },
      { k: 'El acceso ese día', v: 'Techos, garajes, cuartos eléctricos y unidades que no se pueden abrir el día de la inspección obligan a una segunda visita.', save: 'Abra todas las áreas el mismo día: techos, garajes, cuartos eléctricos y las unidades que pida el ingeniero.' },
      { k: 'La oficina que envió la notificación', v: 'Cada oficina de ciudad y de condado tiene sus propios formularios y pasos de presentación, y algunas piden más que otras.' },
    ],
  },
  outside: {
    label: 'Fuera de los honorarios',
    items: [
      { k: 'Reparaciones', v: 'Si la inspección encuentra deficiencias, un contratista cotiza las reparaciones cuando se conoce su alcance, con un permiso de construcción. Su costo depende por completo de lo que se encuentre.' },
      { k: 'Tasas de presentación y de permisos', v: 'La oficina que envió la notificación cobra sus propias tasas de presentación y de permisos, y las cambia de vez en cuando. Pida a esa oficina su tarifa vigente: el paso de presentación está en nuestro proceso, su tasa no está en nuestro precio.' },
      { k: 'Multas por un informe atrasado', v: 'Un informe que no llega a tiempo pasa a cumplimiento, con multas y costos que fija el condado o la ciudad: el único costo que empezar temprano evita. ¿Ya va tarde? Todavía tiene solución.' },
    ],
    lateLink: 'Lo que puede costar esperar',
  },
  save: {
    label: 'Pagar menos',
    first: 'Llame cuando llegue la notificación, no cerca de su fecha: queda tiempo para planear las reparaciones en vez de apurarlas.',
  },
  faq: {
    label: 'Preguntas',
    title: 'Preguntas que hacen los propietarios sobre el precio.',
    items: [
      { q: '¿La propuesta es gratis?', a: 'Sí. Pedir una propuesta no cuesta nada y no lo compromete a nada. Los honorarios se fijan por escrito antes de empezar.' },
      { q: '¿El precio es fijo o se cobra por hora?', a: 'Fijo. La propuesta indica una sola cifra para el alcance que describe, y esos son los honorarios de ese alcance.' },
      { q: '¿Los rangos incluyen reparaciones?', a: 'No. Las reparaciones, los documentos que requieren y sus permisos se cotizan aparte, cuando la inspección ha mostrado qué hace falta.' },
      { q: '¿Las tasas del condado o de la ciudad están en el precio?', a: 'No. Las cobra directamente la oficina que envió la notificación, por el monto que ella fija. Incluimos el paso de presentación, no la tasa.' },
      { q: '¿Una propiedad con varios edificios cuesta más?', a: 'Cada estructura se inspecciona y se informa, así que el total crece con el número de estructuras. Una sola propuesta da el precio de cada edificio por separado.' },
      { q: '¿Cuánto tardan los informes después de la inspección?', a: 'El paquete completo, firmado y sellado, está listo de tres a cuatro días después de la inspección. Cuando la fecha límite está cerca, puede estar listo en uno a dos días.' },
      { q: '¿Qué necesitan para darme una cifra?', a: 'Para empezar basta una foto de la notificación tomada con el teléfono. Los planos o un informe anterior, si los tiene, acercan la cifra a la definitiva.' },
    ],
  },
  programLink: (name) => `${name}: qué incluye`,
};

export function costPage(lang: Lang): CostPage {
  return lang === 'es' ? es : en;
}
