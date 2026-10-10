import type { CityPage } from './cities';

/**
 * CITY PAGES — SPANISH. The rules for this text are in the header of
 * cities.ts; where every row and answer was read is in city-sources.ts.
 * Mirror of cities.en.ts: same slugs, same order, same rows and questions.
 *
 * Read on the cities' own websites on October 9, 2026 (`citiesChecked`).
 * A city's page moves or changes without notice: re-read the record before
 * editing a row, and move the date when you have.
 */
export const cityPagesEs: readonly CityPage[] = [
  {
    slug: 'miami',
    program: 'building-recertification',
    city: 'Ciudad de Miami',
    place: 'la Ciudad de Miami',
    office: {
      name: 'City of Miami Building Department, Unsafe Structures Section',
      address: ['444 SW 2nd Ave, 1st Floor', 'Miami, FL 33130'],
      phone: '(305) 416-1177',
    },
    description:
      'Recertificación de edificios en la Ciudad de Miami: la carta, iBuild y ProjectDox, los formularios y lo que entrega, completo, un solo equipo.',
    heroSub:
      'En la Ciudad de Miami la Unsafe Structures Section lleva la recertificación, y los documentos se presentan en línea. Un solo equipo entrega la suya completa, en los formularios municipales.',
    lede:
      'En la Ciudad de Miami la recertificación pasa por la Unsafe Structures Section (la sección de estructuras inseguras) del Building Department. La ciudad dice que recertifica las estructuras conforme al código del Condado de Miami-Dade, y su página indica que el propietario contrata a un arquitecto o ingeniero para la inspección y luego presenta los documentos en línea. Sigue lo que dicen las propias páginas de Miami, tema por tema.',
    local: [
      { k: 'La notificación', v: 'La página de recertificación de la ciudad se dirige a los propietarios que recibieron una notificación de que su edificio debe recertificarse, y añade que habrán recibido una carta al respecto. La página de Miami no dice quién envía esa carta ni cómo llega. En iBuild, la opción de recertificación solo aparece cuando al edificio le corresponde recertificarse.' },
      { k: 'Presentación del informe', v: 'La Ciudad de Miami recibe la solicitud y los documentos en línea. Su página indica que el solicitante crea una cuenta en iBuild, inicia una Building Permit Application (solicitud de permiso de construcción) y busca la opción “Architect/Engineer (Building Recertification)”. Luego un correo de ePlan/ProjectDox le pide iniciar sesión, y los archivos se suben en ProjectDox.' },
      { k: 'Nombres de los archivos', v: 'Los informes se suben en PDF, guardados conforme a la City of Miami Standard Naming Convention (la convención de nombres de la ciudad): RC-S para el informe estructural y RC-E para el eléctrico; las cartas de presentación y las fotos van aparte, con sus propios nombres. La página de nombres de la ciudad advierte que los archivos mal nombrados pueden rechazarse en el Prescreen (la revisión previa).' },
      { k: 'Formularios de la ciudad', v: 'Miami publica su propia edición del formulario del informe estructural, con el encabezado de la unidad Unsafe Structures del Building Department. La página de recertificación presenta los documentos que enlaza como los requeridos y añade un consejo: los formularios recogen los requisitos mínimos, y el arquitecto o ingeniero quizá quiera incluir más.' },
      { k: 'Qué lo acompaña', v: 'Además de los informes, la página de Miami pide un certificado de iluminación del estacionamiento, si corresponde — la ciudad publica su propio formulario para ello — y una carta de presentación firmada, sellada y fechada, con la recomendación del profesional. Cuando los documentos llevan firma digital, la página exige uno de los proveedores de firma digital que la ciudad indica.' },
      { k: 'Después de presentar', v: 'La página de Miami dice que el solicitante recibe después una de dos cosas — una carta que indica que la recertificación está completa o un aviso con los cambios necesarios — y da un plazo para esa respuesta. Entre las tareas de carga que la misma página enumera en ProjectDox figura una “Applicant resubmit Task” (tarea de reenvío del solicitante).' },
      { k: 'Reparaciones', v: 'La página de Miami fija el orden: el informe se presenta antes de comenzar cualquier reparación. Si hacen falta reparaciones, dice que deben seguirse los trámites de permiso que correspondan antes de que el edificio pueda recertificarse. El formulario estructural de la Ciudad de Miami tiene una casilla para el informe inicial y otra para el informe enmendado tras completar las reparaciones.' },
      { k: 'Si se vence el plazo', v: 'Según la página de Miami, un edificio con la recertificación vencida no puede hacer el trámite en línea: el propietario debe acudir en persona a la Recertification Division de la Unsafe Structures Section, dentro del Building Department. La carta y esa oficina determinan si la recertificación de un edificio se considera vencida.' },
    ],
    faq: [
      {
        q: '¿Cómo presentamos el informe de recertificación ante la Ciudad de Miami?',
        a: 'En línea, salvo que la recertificación esté vencida: entonces la página de Miami exige acudir en persona. Si no, el solicitante abre una cuenta en iBuild, hace allí la solicitud y sube los documentos en ProjectDox. Todo el proceso admite una sola dirección de correo electrónico, y el enlace de carga llega solo a esa dirección — así que decida quién presenta antes de abrir la cuenta. La recertificación completa que entregamos va en los formularios que indica la página de Miami.',
      },
      {
        q: '¿Podemos pedirle más tiempo a la Ciudad de Miami para recertificar?',
        a: 'Una vez, sí. La página de Miami habla de una prórroga única y dice que la solicitud debe recibirse antes de la fecha límite de la recertificación. Se envía por correo electrónico al buzón de recertificaciones de la ciudad, con la dirección completa de la propiedad, y la página da un plazo para la respuesta, aunque no la duración de la prórroga.',
      },
      {
        q: '¿Qué pasa en la Ciudad de Miami si la recertificación no se presenta a tiempo?',
        a: 'Las páginas de Miami no detallan cada paso. Muestran que Unsafe Structures emite infracciones de recertificación, y la guía de audiencias de la ciudad incluye una audiencia de recertificación ante el Unsafe Structures Panel (el panel de estructuras inseguras), que puede dar tiempo para cumplir o exigir la demolición si determina que hay una infracción. Envíenos lo que recibió — basta una foto tomada con el teléfono — y confirmamos qué pide Unsafe Structures y para cuándo.',
      },
      {
        q: '¿Nuestro edificio está exento de la recertificación en la Ciudad de Miami?',
        a: 'La página de Miami indica como exentas las viviendas unifamiliares, los dúplex y las estructuras pequeñas hasta cierto tamaño y carga de ocupación. El propietario que considera exento su edificio pide la exención por correo electrónico, con la dirección completa de la propiedad y sus razones, y la página da un plazo para la respuesta. ¿No sabe cuál es su caso? Envíenos la carta y leemos qué pide la oficina de Miami para su edificio.',
      },
      {
        q: '¿La recertificación de la Ciudad de Miami es la misma recertificación de 40 años?',
        a: 'Sí. Una de las páginas de la propia ciudad, la que trata de cómo apelar una infracción de Unsafe Structures, todavía la llama por su nombre anterior, el de 40 años. El programa es la recertificación de edificios del Condado de Miami-Dade, que la Ciudad de Miami dice llevar a cabo conforme al código del condado; las edades y los días vigentes son los del condado, en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe la carta sobre su edificio en la Ciudad de Miami — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. Leemos qué pide la Unsafe Structures Section y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'miami-beach',
    program: 'building-recertification',
    city: 'Miami Beach',
    place: 'Miami Beach',
    office: {
      name: 'City of Miami Beach Building Department',
      address: ['1700 Convention Center Drive, Second Floor', 'Miami Beach, FL 33139'],
      phone: '(305) 673-7610',
    },
    description:
      'Recertificación de edificios en Miami Beach: cómo notifica el Building Department, cómo presentar el informe y qué entrega, completo, un solo equipo.',
    heroSub:
      'El Building Department de Miami Beach coloca la notificación en la propiedad y revisa el informe. Un solo equipo entrega la recertificación completa, en el informe único que pide la ciudad.',
    lede:
      'En Miami Beach la recertificación pasa por el City of Miami Beach Building Department, en la unidad que su procedimiento escrito llama Recertification Section. El departamento coloca la notificación en el edificio, recibe el informe con firma digital por su portal Citizen Self Service o por correo electrónico y lo revisa antes de la aprobación final del Building Official (el funcionario de construcción). Su página todavía recoge el nombre anterior del programa, la recertificación de 40 años.',
    local: [
      { k: 'La notificación', v: 'El Building Department coloca una notificación en la propiedad mucho antes de que venza la recertificación. Luego se envían recordatorios al acercarse la fecha, el último junto con una notificación colocada en el edificio. El paquete de recertificación pide al propietario que encargue una inspección eléctrica y una estructural del edificio y que presente un informe firmado y sellado ante la Recertification Section.' },
      { k: 'Presentación del informe', v: 'La ciudad pide un solo informe de inspección completo, con el informe estructural y el eléctrico. El informe con firma digital puede presentarse por el portal Citizen Self Service — CSS en las páginas de la ciudad — o por correo electrónico al equipo de Building Recertification. El procedimiento municipal añade que el informe enviado por correo electrónico debería llevar firma y sello digitales verificables por un tercero.' },
      { k: 'En persona', v: 'Según el procedimiento de la ciudad, un informe que no esté firmado y sellado digitalmente puede enviarse escaneado por correo electrónico, y el original firmado y sellado se envía por correo postal o se entrega con cita presencial en el Building Department. Los procedimientos del departamento incluyen además Building Recertification entre sus servicios con cita, y la línea telefónica tiene una opción con ese mismo nombre.' },
      { k: 'Formularios de la ciudad', v: 'En su lista “Required Building Recertification Reporting Forms”, la página de la ciudad incluye un formulario de inspección estructural y uno eléctrico, ambos con el nombre del Building Department, una guía de inspección estructural y dos formularios del estacionamiento — barandas (guardrails) e iluminación — que se presentan donde correspondan. El formulario eléctrico tiene una sección de termografía, cuyo informe se adjunta donde el servicio eléctrico del edificio lo exija.' },
      { k: 'Después de presentar', v: 'Según el procedimiento de la ciudad, el informe pasa a revisión del Chief Structural Engineer y del Chief Electrical Inspector (su ingeniero estructural jefe y su inspector eléctrico jefe). Con ambas aprobaciones, la recertificación pasa al Building Official para la aprobación final. La página de la ciudad dice que el Building Official emite entonces una carta de aprobación de la recertificación, enviada al propietario y al ingeniero o arquitecto responsable.' },
      { k: 'Reparaciones', v: 'Si el primer informe señala deficiencias que requieren permisos, la página municipal exige al propietario un informe actualizado cuando esos permisos hayan pasado la inspección final. El mismo párrafo requiere una carta de presentación que certifique que el edificio es estructural y eléctricamente seguro para su uso y ocupación especificados. Según el procedimiento, el departamento tramita con prioridad esos permisos; el número de recertificación va en la solicitud del permiso.' },
      { k: 'Prórrogas', v: 'Según el procedimiento de la ciudad, puede concederse una prórroga para obtener los permisos de reparación cuando el profesional que inspeccionó el edificio determina que este no supone un peligro para sus ocupantes, declara por escrito que puede seguir ocupado y la solicita. El procedimiento le fija una duración propia; el plazo vigente para las reparaciones es el del condado, en los datos de más abajo.' },
      { k: 'Si se vence el plazo', v: 'El procedimiento describe un recordatorio colocado en el edificio — lo llama Red Tag (etiqueta roja) — cuando, pasado cierto tiempo, el informe no ha llegado al Building Department. Si no se presenta a tiempo ni el informe ni una carta de prórroga, dice, se emite una infracción de recertificación: la Notificación de Infracción (Notice of Violation) se coloca en el edificio y una copia va al propietario por correo certificado.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación de recertificación en Miami Beach?',
        a: 'El City of Miami Beach Building Department. Su procedimiento dice que el Condado de Miami-Dade proporciona la lista de edificios que requieren recertificación y que esa lista se revisa antes de enviar las notificaciones. El informe vuelve a la Recertification Section del departamento. Nos basta una foto, tomada con el teléfono, de la notificación colocada en su edificio para confirmar qué pide y para cuándo.',
      },
      {
        q: '¿Cómo consultamos el estado de la recertificación de un edificio en Miami Beach?',
        a: 'En el portal Citizen Self Service de la ciudad. La página de recertificación explica la búsqueda: se busca entre los permisos, se elige “Existing Building Recertification” como tipo de permiso y se escribe la dirección del edificio. Ese expediente forma parte del historial del edificio que leemos, junto con la notificación, antes de responder con una propuesta para la recertificación completa.',
      },
      {
        q: '¿Podemos recertificar un edificio en Miami Beach con permisos abiertos o infracciones?',
        a: 'No, según el procedimiento de la ciudad. Dice que la recertificación de un edificio no puede aprobarse si la propiedad tiene infracciones de construcción abiertas y permisos abiertos o vencidos. La Letter of Building Recertification (la carta de recertificación del edificio) que prevé el procedimiento se emite cuando, entre otras condiciones, no queda nada de eso y los informes están aprobados. Por eso, entre otras cosas, leemos el historial del edificio antes de proponer nada.',
      },
      {
        q: '¿Qué hace Miami Beach si no presentamos a tiempo el informe de recertificación?',
        a: 'Según el procedimiento de la ciudad, se emite una infracción de recertificación que, si no se subsana dentro del plazo del aviso, pasa al Special Master (el magistrado especial) de Miami Beach. El incumplimiento, añade, lleva el caso a la Unsafe Structure Board del Condado de Miami-Dade y puede acabar en una orden de demolición de la estructura y en la necesidad de desalojar el edificio. La página municipal de infracciones dice que las audiencias del Special Magistrate son presenciales, en el City Hall.',
      },
      {
        q: '¿Qué es el registro anual de mantenimiento (Annual Maintenance Log) que nos pide Miami Beach?',
        a: 'Es un registro anual de reparaciones estructurales de rutina. La página de recertificación de Miami Beach enlaza a ese registro y lo llama obligatorio. La página del registro dice que los propietarios lo presentan antes de la fecha límite que corresponde a la dirección del edificio, en el portal Citizen Self Service, en la solicitud Annual Maintenance Log, y que no todos los edificios deben presentarlo.',
      },
    ],
    nextStep:
      'Envíenos la notificación del Building Department de Miami Beach — basta una foto tomada con el teléfono — o, si aún no hay notificación, la dirección del edificio y el año de construcción. Confirmamos qué pide la Recertification Section y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'hialeah',
    program: 'building-recertification',
    city: 'Hialeah',
    place: 'Hialeah',
    office: {
      name: 'City of Hialeah Building Division',
      address: ['501 Palm Avenue, 2nd Floor', 'Hialeah, FL 33010'],
      phone: '(305) 883-5825',
    },
    description:
      'Recertificación de edificios en Hialeah: cómo notifica la Building Division, qué formularios publica y qué entrega, completo, un solo equipo.',
    heroSub:
      'La Building Division de Hialeah envía por correo las cartas de recertificación y recibe los informes. Un solo equipo entrega el suyo completo, en los formularios que indica la ciudad.',
    lede:
      'En Hialeah la recertificación pasa por la Building Division (la división de construcción de la ciudad). Cada año envía una carta a los propietarios de los edificios que deben recertificarse, y publica su propio juego de formularios y guías para el informe. Lo que sigue es lo que dicen las páginas de la propia ciudad, tema por tema.',
    local: [
      { k: 'La notificación', v: 'La Building Division envía cartas por correo, cada año, a los propietarios de los edificios que deben recertificarse. El formulario de la ciudad pide la fecha de esa Notificación de Inspección Requerida (Notice of Required Inspection), así que conserve la carta: los plazos se cuentan desde ella.' },
      { k: 'Formularios de la ciudad', v: 'Hialeah publica sus propias ediciones rellenables de los formularios del informe estructural y del informe eléctrico, con el nombre de la ciudad, y las guías que los acompañan. Su página de recertificación los presenta como formularios requeridos.' },
      { k: 'Qué los acompaña', v: 'En la misma lista hay un formulario de iluminación del estacionamiento, una declaración jurada sobre las barandas (guardrails) del estacionamiento y un modelo de carta de cumplimiento, que el profesional escribe en su papel membretado y dirige al Building Official (el funcionario de construcción). Los dos documentos del estacionamiento se presentan donde correspondan a la propiedad.' },
      { k: 'Presentación electrónica', v: 'La lista incluye también una declaración jurada que autoriza la presentación electrónica en lugar de copias impresas firmadas y selladas. La página de la ciudad no dice cómo se entrega un informe de recertificación, así que lo confirmamos con la Building Division antes de presentar nada.' },
      { k: 'Reparaciones', v: 'El formulario estructural de la ciudad se marca como informe inicial o como informe enmendado tras completar las reparaciones, y pregunta si el edificio puede seguir ocupado mientras duran la recertificación y las reparaciones.' },
      { k: 'Si se vence el plazo', v: 'La página de Hialeah dice que un edificio cuyo informe no llega a tiempo se considera inseguro y en incumplimiento conforme al código del condado, que el caso pasa a una audiencia ante el Special Magistrate (el magistrado especial) de la ciudad y que puede revocarse el Certificado de Ocupación.' },
      { k: 'Nombres antiguos', v: 'Algunos documentos de la ciudad todavía llevan el nombre anterior del programa, la recertificación de 40 años — las guías y el modelo de carta, entre ellos. Es el mismo programa; las edades vigentes están en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Quién envía la notificación de recertificación en Hialeah?',
        a: 'La Building Division de la Ciudad de Hialeah. Envía cartas por correo cada año a los propietarios de los edificios que deben recertificarse, y el informe vuelve a esa misma oficina. Envíenos la carta — basta una foto tomada con el teléfono — y confirmamos qué pide y para cuándo.',
      },
      {
        q: '¿Hialeah tiene sus propios formularios de recertificación?',
        a: 'Sí. La ciudad publica con su propio nombre formularios rellenables para el informe estructural y el eléctrico, junto con las guías, los dos documentos del estacionamiento y un modelo de carta de cumplimiento. El paquete completo que entregamos va en los formularios que indica la página de la ciudad.',
      },
      {
        q: '¿Qué pasa en Hialeah si el informe de recertificación se entrega tarde?',
        a: 'La página de la ciudad dice que el edificio se considera inseguro y en incumplimiento, que se cita al propietario a una audiencia ante el Special Magistrate de la ciudad y que puede revocarse el Certificado de Ocupación. ¿Ya pasó la fecha de su carta? Envíela igual: el primer paso es la inspección y el informe.',
      },
      {
        q: '¿Cuánto tiempo tenemos para recertificar un edificio en Hialeah?',
        a: 'El plazo es el del condado y se cuenta desde la notificación: está en los datos de arriba, en el plazo para presentar y en el de las reparaciones. La página de Hialeah no da un número de días — habla del “tiempo asignado” — así que la fecha que vale es la de su carta.',
      },
      {
        q: '¿La recertificación de Hialeah es la misma recertificación de 40 años?',
        a: 'Sí. Varios documentos de la ciudad todavía usan ese nombre. El programa es la recertificación de edificios del Condado de Miami-Dade, que la Building Division de Hialeah administra dentro de la ciudad; hoy la primera inspección vence antes de lo que dice el nombre antiguo.',
      },
    ],
    nextStep:
      'Envíe la carta de la Building Division de Hialeah — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. Leemos lo que pide la ciudad y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'coral-gables',
    program: 'building-recertification',
    city: 'Coral Gables',
    place: 'Coral Gables',
    office: {
      name: 'City of Coral Gables Building Division',
      address: ['427 Biltmore Way', 'Coral Gables, FL 33134'],
      phone: '(305) 460-5229',
    },
    description:
      'Recertificación de edificios en Coral Gables: notificaciones de la Building Division, presentación por el portal y entrega completa de un solo equipo.',
    heroSub:
      'La Building Division de Coral Gables notifica por correo; los informes se suben al portal municipal de permisos. Un solo equipo entrega el suyo completo, en las plantillas de Miami-Dade.',
    lede:
      'En Coral Gables, la City of Coral Gables Building Division (la división de construcción) envía por correo las notificaciones de la recertificación de edificios del condado. El informe completo se prepara en las plantillas de Miami-Dade y se sube al portal web de permisos de la ciudad. A continuación, lo que dicen las páginas de la propia ciudad y su guía Permit Requirements (requisitos de permisos), tema por tema.',
    local: [
      { k: 'La notificación', v: 'La Building Division envía por correo una Notificación de Recertificación Requerida (Notice of Required Recertification) a los propietarios de los edificios a los que se aplica el programa; antes se envían también notificaciones de cortesía para que puedan prepararse. La página del programa de Coral Gables enlaza además, año por año, una lista de las propiedades de la ciudad que deben recertificarse (Building Recertification List).' },
      { k: 'Presentación del informe', v: 'El informe completo va al Building Official (el funcionario de construcción) y se sube electrónicamente a lo que la página del programa llama el portal web de permisos de la ciudad. La guía Permit Requirements añade que la presentación sigue la Electronic Submittal Guide (la guía de presentación electrónica de la ciudad), que trata la firma y el sello digitales y pide archivos PDF.' },
      { k: 'Formularios de la ciudad', v: 'La página de Coral Gables pide el informe en las plantillas de Miami-Dade. La guía Permit Requirements enumera formularios del Condado de Miami-Dade — entre ellos la recertificación estructural, las fotos del edificio y la recertificación eléctrica — y la página del programa remite a pautas para el componente estructural y para el componente eléctrico del informe.' },
      { k: 'Qué lo acompaña', v: 'Según la página de Coral Gables, un informe completo incluye el informe estructural, el eléctrico y la carta o cartas de presentación del profesional, que certifican que el sistema eléctrico y la estructura del edificio son seguros para el uso y la ocupación previstos. La misma lista trae dos formularios de certificación del estacionamiento, el de barandas (guardrails) y el de iluminación, que se presentan donde correspondan.' },
      { k: 'Archivos adicionales', v: 'Si la propiedad tiene más de un edificio, la página de la ciudad pide un plano del sitio o de agrimensura (survey) que muestre cada uno e identifique claramente el que cubre el informe. La guía Permit Requirements añade, si corresponde, una inspección de termografía infrarroja (que la guía vincula al amperaje), un informe de inspección preliminar (Preliminary Inspection Report) y una solicitud de prórroga.' },
      { k: 'Después de presentar', v: 'Con la estructura en cumplimiento, Coral Gables emite una carta de recertificación (Building Recertification letter). Su página del programa no describe la revisión previa. Para permisos en general, sus preguntas frecuentes dicen que los comentarios de revisión se publican en el portal Citizen Self Service (CSS) y que las correcciones llegan además por correo electrónico; según la Electronic Submittal Guide, se suben con el botón “Resubmit” y una nota explicativa.' },
      { k: 'Prórrogas', v: 'La página de la ciudad dice que el Building Official puede conceder prórrogas por causa justificada, siempre que se acepten declaraciones juradas de que el edificio puede seguir ocupado mientras se recertifica o espera un permiso o reparaciones. Es todo lo que la página dice sobre las reparaciones; el plazo del condado para ellas está en los datos de más abajo.' },
      { k: 'Si se vence el plazo', v: 'Según la página de Coral Gables, si el informe no llega dentro del plazo, la estructura se considera insegura y en incumplimiento conforme al Código del Condado de Miami-Dade, y no recertificar lleva a una audiencia ante la Construction Regulation Board (la junta municipal de regulación de la construcción). Añade que puede revocarse el Certificado de Ocupación y que el Building Official puede ordenar cortar los servicios públicos.' },
    ],
    faq: [
      {
        q: '¿Qué es la notificación de cortesía de recertificación que nos envió Coral Gables?',
        a: 'La página de Coral Gables dice que también se envían por correo notificaciones de cortesía a los propietarios, con antelación, para que puedan prepararse para la recertificación que se acerca. El plazo para presentar lo cuenta desde que se recibe la notificación de recertificación de la ciudad (Recertification Notice). Envíenos la que haya recibido — basta una foto con el teléfono — y confirmamos qué pide la Building Division de Coral Gables y para cuándo.',
      },
      {
        q: '¿Cómo presentamos un informe de recertificación en Coral Gables?',
        a: 'Por vía electrónica. La página de la ciudad dice que el informe completo se sube a su portal web de permisos — para los permisos, las preguntas frecuentes de la ciudad nombran el portal Citizen Self Service (CSS) — y que no se requiere ninguna solicitud para presentarlo. La guía Permit Requirements, sin embargo, indica solicitar “Building Recertification – Recertification”. Antes de subir nada, confirmamos con la Building Division cuál de las dos cosas espera.',
      },
      {
        q: '¿Cuánto tiempo tenemos para recertificar un edificio en Coral Gables?',
        a: 'La página de Coral Gables cuenta el plazo desde que se recibe la notificación de recertificación de la ciudad (el número de días es el del condado y está en los datos de arriba), así que conserve la notificación y anote el día en que llegó. La página dice también que el Building Official puede conceder prórrogas por causa justificada, siempre que se acepten declaraciones juradas de que el edificio puede seguir ocupado.',
      },
      {
        q: '¿Qué edificios están exentos de la recertificación en Coral Gables?',
        a: 'La página de Coral Gables dice que las únicas estructuras exentas son las viviendas unifamiliares, los dúplex y las estructuras menores; una nota define estas últimas con los límites de carga de ocupantes y de área bruta del código del condado. Una advertencia al leerla: la línea bajo el título todavía da la edad anterior y el texto que sigue da otra; las edades vigentes son las del condado, en los datos de arriba.',
      },
      {
        q: '¿Qué pasa en Coral Gables si no presentamos a tiempo el informe de recertificación?',
        a: 'La página de la ciudad dice que entonces la estructura se considera insegura y en incumplimiento y que sigue una audiencia ante la Construction Regulation Board de la ciudad; puede revocarse el Certificado de Ocupación y el Building Official puede ordenar cortar los servicios públicos. Si ya pasó la fecha de su notificación de Coral Gables, envíenosla igual: la leemos junto con el historial del edificio y respondemos con una propuesta para la recertificación completa.',
      },
    ],
    nextStep:
      'Envíe la notificación de la Building Division de Coral Gables — también la de cortesía; basta una foto con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. Confirmamos qué pide Coral Gables y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'doral',
    program: 'building-recertification',
    city: 'Doral',
    place: 'Doral',
    office: {
      name: 'City of Doral Building Department',
      address: ['8401 NW 53rd Terrace', 'Doral, FL 33166'],
      phone: '(305) 593-6700',
    },
    description:
      'Recertificación de edificios en Doral: cómo recibe los informes el Building Department, qué los acompaña y qué entrega, completo, un solo equipo.',
    heroSub:
      'El Building Department lleva la recertificación en Doral: los informes van al City Hall o al sistema de permisos municipal. Un solo equipo la entrega completa, en las plantillas del condado que Doral acepta.',
    lede:
      'En Doral la recertificación está a cargo del Building Department (el departamento de construcción), que la incluye entre sus programas y publica su propia guía. La página de la ciudad dice que, además de sus ordenanzas locales, Doral sigue y hace cumplir el Código del Condado de Miami-Dade. La ciudad acepta las plantillas del condado para los informes; lo que dicen sus páginas se expone aquí, tema por tema.',
    local: [
      { k: 'La notificación', v: 'La página de Doral dice que los propietarios de los inmuebles que requieren certificación reciben una Notificación de Recertificación Requerida (Notice of Required Recertification), que da inicio al proceso, y que se crea un registro en el sistema de permisos municipal. Sus páginas no dicen cómo se entrega la notificación. Para la cuenta del portal, la página remite a todos los usuarios a la de Videos and Tutorials.' },
      { k: 'Presentación del informe', v: 'La guía del Building Department ofrece dos vías. En persona, los informes terminados se entregan en el solution center (centro de atención), en el segundo piso del Doral City Hall. En línea, el solicitante crea un contacto en el sistema de permisos municipal — CSS, el portal Citizen Self-Service —, busca “Building Recertification” y elige “apply”. La página del programa añade una advertencia para la recertificación inicial; vea la primera pregunta, más abajo.' },
      { k: 'Digital o en papel', v: 'La página de Doral pide que cada hoja del informe estructural y del eléctrico vaya firmada y sellada, salvo que se presente electrónicamente con firma digital verificable. Según la guía, las firmas digitales solo pueden transmitirse electrónicamente; un sello húmedo o en relieve debe presentarse en persona. La página aconseja guardar el archivo como PDF antes de aplicar la firma, para que el informe subido no quede bloqueado.' },
      { k: 'Formularios de la ciudad', v: 'La guía de Doral dice que se aceptan las plantillas del Condado de Miami-Dade, y la página del programa remite a la del condado para las plantillas y los formularios. También señala que los lineamientos y las plantillas de los informes se revisaron, con la aprobación de la Board of Rules and Appeals (la junta de reglas y apelaciones). La recertificación completa que entregamos va en esas plantillas.' },
      { k: 'Qué lo acompaña', v: 'Entre sus documentos mínimos, la guía de Doral incluye una carta de presentación estructural y otra eléctrica, firmadas, selladas y fechadas, y, donde lo requiera la capacidad del servicio eléctrico del edificio, un informe de termografía infrarroja. Para una propiedad con más de un edificio, la página del programa añade un plano del sitio o de agrimensura (survey) que ubique cada uno e identifique con claridad el edificio del informe.' },
      { k: 'Prórrogas', v: 'La página de Doral dice que se admite una única prórroga, de la duración que ella fija, siempre que sea seguro ocupar el edificio. Se solicita con una carta firmada y sellada del profesional a cargo, por correo electrónico al Building Official (el funcionario de construcción). La carta debe confirmar, entre otras cosas, que es seguro ocupar el edificio mientras se emite el informe final, e indicar si hacen falta reparaciones.' },
      { k: 'Si se vence el plazo', v: 'La página de Doral dice que los procesos vencidos y los edificios que no hayan sido recertificados se remitirán a code compliance (cumplimiento de códigos) para una acción inmediata. No dice en qué consiste esa acción ni nombra ningún órgano que celebre audiencias. En Doral el plazo para presentar es el del condado, en los datos de más abajo.' },
      { k: 'Nombres antiguos', v: 'La guía de Doral y el directorio del departamento todavía presentan el Building Recertification Program como la antigua recertificación de 40 años, y la página de tutoriales remite a los propietarios, para los requisitos de recertificación de un edificio, a su “Building Milestone page”. La página del programa conserva además fechas que ya pasaron; las edades y los plazos vigentes son los del condado, en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Podemos presentar en línea nuestro primer informe de recertificación en Doral?',
        a: 'Las páginas de Doral no lo dejan claro. La guía describe una solicitud en línea, pero la página del programa dice que el sistema de permisos acepta informes de recertificación de “renovación”, posteriores a una recertificación inicial, y pide no solicitar la inicial (“initial Building Milestone recertification”) por esa clase de trámite (work class). La otra vía de la guía es presencial, en el Doral City Hall. Envíenos la carta y confirmamos con el Building Department qué vía corresponde a su edificio.',
      },
      {
        q: '¿Doral pide los documentos del estacionamiento para la recertificación?',
        a: 'En parte. La guía de Doral incluye los requisitos de iluminación del estacionamiento entre sus documentos mínimos, así que esa parte se presenta donde corresponda a la propiedad. Las barandas (guardrails) del estacionamiento son otro asunto: la página de la ciudad dice que ese requisito no se exige en la Ciudad de Doral y se aplica solo a la zona no incorporada del Condado de Miami-Dade. Confirmamos con el Building Department qué debe llevar el paquete de su propiedad.',
      },
      {
        q: '¿Qué edificios de Doral no pasan por la recertificación?',
        a: 'Las páginas de Doral mencionan las viviendas unifamiliares, los dúplex y los edificios dentro de los límites de carga de ocupantes y de superficie que indican. Según la guía, quien crea que su edificio está exento pide la exención escribiendo al correo electrónico del programa, con la dirección completa de la propiedad y sus razones.',
      },
      {
        q: '¿Qué pasa después de presentar el informe de recertificación en Doral?',
        a: 'Las páginas de Doral no describen la revisión: quién lee el informe, cómo se responde al propietario ni qué cierra el caso. Lo que sí dan es una referencia: cada edificio en proceso recibe un número que empieza por “BDAD”. Según la página, los nombres de archivo y las cartas pueden llevarlo, junto con las palabras “Building Recertification”. Las preguntas se envían al correo electrónico que Doral indica para el programa.',
      },
      {
        q: '¿Qué dice Doral sobre las reparaciones después del informe de recertificación?',
        a: 'La página de recertificación de Doral no tiene una sección sobre reparaciones. Su única mención está en la solicitud de prórroga: la carta debe indicar si hacen falta reparaciones y confirmar que el edificio puede ocuparse con seguridad mientras se emite el informe final. El plazo para las reparaciones en Doral es el del condado y está en los datos de arriba. Lo que pida el Building Department para las reparaciones en sí lo confirmamos con la oficina.',
      },
    ],
    nextStep:
      'Envíenos la Notificación de Recertificación Requerida de su edificio en Doral — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. La leemos, confirmamos qué pide el Building Department de Doral y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'north-miami',
    program: 'building-recertification',
    city: 'North Miami',
    place: 'North Miami',
    office: {
      name: 'City of North Miami Building Department',
      address: ['12340 NE 8th Avenue', 'North Miami, FL 33161'],
      phone: '(305) 895-9820',
    },
    description:
      'Recertificación de edificios en North Miami: qué dice la página de la ciudad, qué formularios publica y qué entrega, completo, un solo equipo.',
    heroSub:
      'North Miami incluye la recertificación entre los servicios de su Building Department y publica los formularios aprobados por el condado: en ellos, un solo equipo entrega la recertificación completa.',
    lede:
      'El City of North Miami Building Department (el departamento de construcción de la ciudad) incluye la recertificación entre sus servicios, y la ciudad le dedica una página. Es breve: dice qué edificios están cubiertos, publica los formularios aprobados por el condado, nombra a un Building Officer como contacto y remite, para orientación, a la página de recertificación del Condado de Miami-Dade. Donde calla, los datos de más abajo lo indican.',
    local: [
      { k: 'La notificación', v: 'La página de North Miami no dice quién envía la notificación ni cómo llega. Solo la menciona entre las exenciones: si se recibe una, es responsabilidad del propietario solicitar una exención por escrito al Building Official (el funcionario de construcción). El formulario estructural que publica la ciudad pide la fecha de la Notificación de Inspección Requerida (Notice of Required Inspection): conserve la carta.' },
      { k: 'Quién está exento', v: 'La página de North Miami dice que todos los edificios y estructuras están cubiertos, salvo las viviendas unifamiliares y los dúplex, los edificios agrícolas exentos y los edificios menores dentro de un límite de superficie y otro de ocupación. Añade que deben cumplirse ambas condiciones y que la ocupación que cuenta es la carga potencial según la clasificación de uso del edificio en el código.' },
      { k: 'Formularios de la ciudad', v: 'North Miami publica cuatro documentos en una lista titulada “Miami-Dade County Approved forms for Report Submittal” (formularios aprobados por el Condado de Miami-Dade para presentar el informe). Dos son los formularios del informe — las guías de inspección de recertificación, la estructural y la eléctrica — y el estructural lleva la leyenda “MDC Building Recertification Structural Report”; los otros dos son certificaciones del estacionamiento.' },
      { k: 'Qué los acompaña', v: 'Los dos documentos del estacionamiento son certificaciones de cumplimiento, una sobre las barandas (guardrails) y otra sobre la iluminación; North Miami incluye ambas en su lista, y cada una se presenta donde corresponda a la propiedad. El formulario eléctrico que publica la ciudad tiene además una sección para los resultados de la termografía infrarroja, que se completa cuando el servicio eléctrico del edificio la requiere.' },
      { k: 'Presentación del informe', v: 'La página de North Miami no dice cómo ni dónde se presenta el informe, ni qué ocurre después: no nombra un portal, una dirección de correo electrónico ni una ventanilla para entregarlo. Su contacto para el programa es un Building Officer, en el teléfono del Building Department. La carta y esa oficina definen la vía de presentación; nosotros la confirmamos antes con el departamento.' },
      { k: 'Reparaciones', v: 'La página de recertificación de North Miami no menciona permisos para reparaciones. Sí lo hace su certificación de barandas: cuando no hay una baranda que cumpla, hace constar que se indicó al propietario que debe obtener un permiso para instalarla. Aparte, la página de permisos en línea de la ciudad — sobre permisos en general — dice que los trabajos fuera de su lista exigen una solicitud en persona.' },
      { k: 'Si se vence el plazo', v: 'La página de North Miami no fija un plazo propio, y no dice cómo se pide una prórroga ni qué sigue a un informe entregado tarde. Para orientación y preguntas remite a la página de recertificación del Condado de Miami-Dade. Los plazos del condado para presentar y reparar están en los datos de más abajo.' },
      { k: 'El nombre del programa', v: 'La página de North Miami lleva por título “Milestone Recertification”, seguido del ciclo en años. Es el programa que todavía se conoce como la recertificación de 40 años: la página cuenta su origen y dice que Miami-Dade acortó después el ciclo de inspección. Sus formularios son los que el condado aprueba para el informe; las edades vigentes están en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Cómo presentamos el informe de recertificación en North Miami?',
        a: 'La página de North Miami no lo dice. Publica los formularios y nombra a un Building Officer como contacto, pero no indica un portal, una dirección de correo electrónico ni una ventanilla para el informe. Lo definen su carta y el Building Department, y nosotros confirmamos la vía con esa oficina antes de presentar la recertificación completa.',
      },
      {
        q: '¿North Miami tiene sus propios formularios de recertificación?',
        a: 'Publica cuatro, y son formularios aprobados por el condado: la página de la ciudad los presenta como “Miami-Dade County Approved forms for Report Submittal”. Son los formularios del informe estructural y del informe eléctrico y dos certificaciones del estacionamiento, la de barandas (guardrails) y la de iluminación, que se presentan donde correspondan. La recertificación completa que entregamos va en los formularios que indica North Miami.',
      },
      {
        q: '¿Qué edificios de North Miami están exentos de la recertificación?',
        a: 'La página de North Miami dice que todos los edificios y estructuras están cubiertos, salvo tres grupos: las viviendas unifamiliares y los dúplex, los edificios agrícolas exentos y los edificios menores dentro de un límite de superficie y otro de ocupación. Añade que, si se recibe una notificación de recertificación, es responsabilidad del propietario solicitar una exención por escrito al Building Official.',
      },
      {
        q: '¿Qué plazo tenemos para la recertificación en North Miami?',
        a: 'La página de North Miami no fija ninguno: para orientación remite a la página de recertificación del Condado de Miami-Dade, y no dice qué sigue a un informe entregado tarde. Los plazos del condado para presentar y reparar están en los datos de arriba; la fecha que cuenta es la de su propia carta. Si esa fecha ya pasó, envíenos la carta igualmente y preguntamos al Building Department qué espera ahora.',
      },
      {
        q: '¿La “Milestone Recertification” de North Miami es la misma recertificación de 40 años?',
        a: 'Sí. La página de North Miami cuenta la historia del programa del condado, desde su origen hasta los cambios que adoptó Miami-Dade, que acortaron el ciclo de inspección; hoy la primera inspección llega antes de lo que sugiere aquel nombre. Los formularios que publica North Miami son los que el condado aprueba para el informe, y las edades vigentes están en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíenos su carta de recertificación — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. La leemos, confirmamos con el Building Department de North Miami qué pide y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'north-miami-beach',
    program: 'building-recertification',
    city: 'North Miami Beach',
    place: 'North Miami Beach',
    office: {
      name: 'City of North Miami Beach Building Department',
      address: ['17050 NE 19th Avenue, 1st Floor', 'North Miami Beach, FL 33162'],
      phone: '(305) 948-2965',
    },
    description:
      'Recertificación de edificios en North Miami Beach: cómo notifica la ciudad, dónde se presenta el informe y qué entrega, completo, un solo equipo.',
    heroSub:
      'El Building Department de North Miami Beach notifica por correo certificado; su Governmental Compliance Section recibe el informe. Un solo equipo entrega la recertificación completa en los formularios de North Miami Beach.',
    lede:
      'En North Miami Beach la recertificación pasa por el City of North Miami Beach Building Department (su departamento de construcción). El departamento notifica al propietario por correo certificado, el informe terminado va a su Governmental Compliance Section para revisión y aprobación, y el Building Official emite la carta de aprobación. Esto es lo que dicen, tema por tema, la página de recertificación de North Miami Beach y los documentos publicados en ella.',
    local: [
      { k: 'La notificación', v: 'Según la hoja de North Miami Beach sobre la notificación al propietario, cuando a un edificio le corresponde, el Building Department envía la notificación por correo certificado al propietario o a su representante. La notificación que publica la ciudad indica una persona de contacto, con teléfono y correo electrónico, para más información. Conserve la carta: esa misma hoja cuenta el plazo de presentación desde que se recibe.' },
      { k: 'Presentación del informe', v: 'Según la página de recertificación de la ciudad, el informe terminado va a la Governmental Compliance Section (la sección de cumplimiento gubernamental) del Building Department; una de las hojas de la ciudad nombra, en cambio, la Engineering Section. Ninguna de esas páginas dice cómo se entrega: no indican portal, ventanilla ni correo electrónico. Por eso lo confirmamos con el Building Department de North Miami Beach antes de presentarlo.' },
      { k: 'Formularios de la ciudad', v: 'North Miami Beach publica sus propios formularios para el informe estructural y el informe eléctrico, ambos con el encabezado del Building Department. Las guías que North Miami Beach publica con ellos dicen que deben usarse los formularios de informe aprobados que se facilitan y que no se aceptan formularios de elaboración propia. La recertificación completa que entregamos va en los formularios de North Miami Beach.' },
      { k: 'Qué los acompaña', v: 'La hoja de la ciudad sobre la notificación al propietario dice que el informe incluye también un estudio de iluminación de las áreas de estacionamiento, y que los informes de recertificación llevan sello en relieve y firma. Las guías de North Miami Beach piden una inspección de termografía infrarroja, con informe escrito, cuando el servicio eléctrico del edificio alcanza la capacidad que ellas fijan.' },
      { k: 'Después de presentar', v: 'Cuando los informes quedan aprobados, el Building Official (el funcionario de construcción) emite una carta de aprobación de la recertificación, que se envía al propietario y al profesional que figura como responsable; la ciudad pide conservarla como constancia de la aprobación. Las guías de North Miami Beach añaden que los informes pueden auditarse, y el edificio inspeccionarse, a criterio del Building Official.' },
      { k: 'Reparaciones', v: 'Según North Miami Beach, el propietario debe contratar a un contratista con licencia de Florida y obtener los permisos del Building Department antes de cualquier reparación o modificación. Aprobada la inspección final de cada permiso, un informe firmado y sellado debe declarar que las reparaciones están completas y que el edificio es seguro, estructural y eléctricamente, para seguir en uso; el plazo para reparar está en los datos de más abajo.' },
      { k: 'Prórrogas', v: 'Las páginas de North Miami Beach no describen ningún formulario ni trámite para pedir más tiempo. Las guías que publica la ciudad solo dicen que las reparaciones que se hacen con permiso dan tiempo adicional para cumplir con un informe de recertificación completo. Cómo se aplica eso a un edificio concreto es una pregunta para el Building Department de North Miami Beach.' },
      { k: 'Si se vence el plazo', v: 'Según las hojas de la ciudad, un informe fuera de plazo acarrea una infracción (Building Violation), y el aviso de infracción (Notice of Violation) se fija en el edificio y se envía por correo certificado al propietario registrado. La hoja Violation of Recertification Process añade que, si el propietario no responde, la infracción se remite a la Unsafe Structure Board (la junta de estructuras inseguras) para una audiencia.' },
    ],
    faq: [
      {
        q: '¿Dónde presentamos el informe de recertificación en North Miami Beach?',
        a: 'Según la página de recertificación de North Miami Beach, el informe terminado va a la Governmental Compliance Section de su Building Department; la página no dice si se entrega en línea, por correo electrónico o en ventanilla. Una hoja de la ciudad indica un contacto, por correo electrónico o teléfono, para iniciar el trámite. La página Important Notice del departamento pide a los clientes registrarse en su sistema Q-Less para ser atendidos sin demora: un aviso general, no sobre la recertificación.',
      },
      {
        q: '¿Tenemos que recertificar nuestro edificio en North Miami Beach?',
        a: 'La página de recertificación de la ciudad abarca todos los edificios salvo las viviendas unifamiliares, los dúplex y las estructuras menores, y define el edificio menor por un máximo de ocupantes y de superficie bruta. Trata los edificios de condominios y cooperativas cercanos a la costa, desde cierta altura, como un grupo aparte con una primera recertificación más temprana. La página de North Miami Beach da edades para ambos grupos; las vigentes están en los datos de arriba.',
      },
      {
        q: '¿Qué pasa en North Miami Beach si entregamos tarde el informe de recertificación?',
        a: 'Según la ciudad, un informe tardío acarrea una infracción (Building Violation), con un aviso (Notice of Violation) que se fija en el edificio y se envía por correo certificado al propietario registrado. Su Notificación de Inspección Requerida (Notice of Required Building Inspection) va más lejos: el edificio que no se recertifique en el tiempo que da tras ese aviso se declara inseguro y se desaloja a costa del propietario. Si su fecha ya pasó, envíenos igualmente la notificación de North Miami Beach.',
      },
      {
        q: '¿La recertificación de North Miami Beach es la misma recertificación de 40 años?',
        a: 'Sí. La hoja sobre la notificación al propietario que publica la ciudad todavía llama al programa por ese nombre anterior. Es la recertificación de edificios del Condado de Miami-Dade, que el City of North Miami Beach Building Department gestiona dentro de la ciudad; si una hoja de la ciudad y los datos de arriba difieren en una edad o en un plazo, los vigentes son los de arriba.',
      },
      {
        q: '¿Necesitan permiso las reparaciones de una recertificación en North Miami Beach?',
        a: 'Las guías que publica North Miami Beach dicen que el informe inicial debería presentarse en cuanto esté terminado y que no se debe reparar sin permisos; ponen además la legalización de una ampliación sin permiso como requisito previo para un informe de recertificación satisfactorio. Los permisos se obtienen en el Building Department, cuya página Important Notice dice que los contratistas registrados pueden presentar en línea solicitudes de permiso de todo tipo.',
      },
    ],
    nextStep:
      'Envíenos la notificación del Building Department de North Miami Beach — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. Confirmamos qué pide North Miami Beach y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'aventura',
    program: 'building-recertification',
    city: 'Aventura',
    place: 'Aventura',
    office: {
      name: 'City of Aventura Building Division',
      address: ['19200 West Country Club Drive, 4th Floor', 'Aventura, FL 33180'],
      phone: '(305) 466-8937',
    },
    description:
      'Recertificación de edificios en Aventura: envío en línea a la Building Division, los formularios que indica la ciudad y su ordenanza sobre informes.',
    heroSub:
      'La Building Division de Aventura administra la recertificación y recibe los documentos en línea. Un solo equipo la entrega completa, conforme a las guías del condado que indica la ciudad.',
    lede:
      'En Aventura la recertificación la administra la City of Aventura Building Division (la división de construcción), conforme a los requisitos del Condado de Miami-Dade. La notificación la envía la ciudad, que usa las guías vigentes del condado, y los documentos se presentan por vía electrónica. Aventura tiene además ordenanzas propias, sobre informes de ingeniería y sobre mantenimiento estructural anual; los plazos del condado están en los datos de más abajo.',
    local: [
      { k: 'La notificación', v: 'La carta la envía la Ciudad de Aventura, y la página de la ciudad la llama Notificación de Recertificación Requerida del Edificio (Notice of Required Building Recertification). Según la página, el propietario que la recibe debe encargar las inspecciones requeridas y presentar a la ciudad la documentación requerida. La página de Aventura no dice cómo ni cuándo se envía la notificación.' },
      { k: 'Formularios de la ciudad', v: 'La página de Aventura dice que la ciudad usa las guías de recertificación vigentes del Condado de Miami-Dade, y no muestra ningún formulario propio. Su lista incluye las guías de inspección del condado, estructural y eléctrica, y dos certificados del estacionamiento, iluminación y barandas (guardrails), que se presentan donde correspondan. El paquete de recertificación del Document Center de Aventura dice que deben usarse los formularios de informe aprobados.' },
      { k: 'Presentación del informe', v: 'La página de Aventura dice que los documentos de la recertificación deben presentarse por vía electrónica ante la Building Division, mediante el proceso de solicitudes en línea de la ciudad. Las instrucciones a las que enlaza están escritas para solicitudes de permiso: quien envía indica su correo electrónico y coloca los archivos en un recuadro de carga, y el sistema ePermits de la ciudad envía sus avisos a ese correo.' },
      { k: 'Después de presentar', v: 'Según las mismas instrucciones, escritas para solicitudes de permiso, el equipo de E-Permits de la Building Division responde por correo electrónico: confirma que el envío fue aceptado para revisión o pide lo que falte. El paquete de recertificación de Aventura añade que los informes pueden auditarse, que el edificio puede inspeccionarse a criterio del Building Official (el funcionario de construcción) y que este puede anular o revocar un informe aprobado.' },
      { k: 'Reparaciones', v: 'El paquete de recertificación de Aventura dice que el informe inicial debe presentarse en cuanto esté terminado, y que no deben hacerse reparaciones sin permisos. El paquete de Aventura añade que las reparaciones hechas con permiso dan tiempo adicional para cumplir con un informe de recertificación completo.' },
      { k: 'Informes de ingeniería', v: 'Una ordenanza propia de Aventura dice que, cuando el presidente o el administrador de una asociación de condominio, de propietarios o de cooperativa recibe un informe de ingeniero o arquitecto sobre las condiciones estructurales, eléctricas o de seguridad humana (life safety) de un edificio, debe presentarlo ante la ciudad dentro del plazo que fija la ordenanza. Se entrega por correo electrónico, o en mano, en formato digital y en copia impresa.' },
      { k: 'Informes publicados en línea', v: 'La página del Enhanced Building Safety Inspections Program de Aventura enlaza a un centro de documentos en línea donde se añaden, a medida que llegan, los informes de ingeniería que recibe la ciudad. Los documentos de recertificación anteriores los conserva la Building Division y se añadirán a ese centro con el tiempo. Las preguntas sobre el estado de un edificio se dirigen al Community Development Department (el departamento de desarrollo comunitario).' },
      { k: 'Certificación anual', v: 'Además del programa del condado, una ordenanza de Aventura exige certificar cada año que los sistemas estructurales del edificio han recibido mantenimiento. El formulario de la ciudad, el Annual Structural Maintenance Checklist (lista anual de mantenimiento estructural), se presenta cada año a más tardar en la fecha impresa en él. Cuando un elemento necesita reparación o reemplazo, y no solo mantenimiento, se adjunta un informe de ingeniería sobre esos hallazgos.' },
    ],
    faq: [
      {
        q: '¿Cómo presentamos el informe de recertificación en Aventura?',
        a: 'Por vía electrónica. La página de Aventura dice que los documentos de la recertificación deben presentarse ante la Building Division mediante el proceso de solicitudes en línea de la ciudad. Las instrucciones a las que enlaza se escribieron para solicitudes de permiso y no dicen nada específico de una recertificación, así que confirmamos con la Building Division qué debe incluir el envío antes de presentar el paquete.',
      },
      {
        q: '¿Aventura tiene sus propios formularios de recertificación?',
        a: 'Su página de recertificación no muestra ninguno. Aventura dice que usa las guías de recertificación vigentes del Condado de Miami-Dade, y la página incluye las guías de inspección estructural y eléctrica del condado junto con el certificado de iluminación del estacionamiento y el de sus barandas (guardrails), donde correspondan. La recertificación completa que entregamos va en los formularios aprobados; el paquete de Aventura dice que no se aceptan los de elaboración propia.',
      },
      {
        q: '¿La certificación anual de mantenimiento estructural de Aventura es lo mismo que la recertificación?',
        a: 'No. Una ordenanza de Aventura pide certificar cada año que los sistemas estructurales del edificio han recibido mantenimiento, en el Annual Structural Maintenance Checklist de la ciudad. Se entrega por correo electrónico o en mano en el Aventura Government Center — en mano, con copia impresa y copia digital. La recertificación es el programa que la Building Division administra conforme a los requisitos del Condado de Miami-Dade, para los propietarios a quienes la ciudad notifica.',
      },
      {
        q: '¿La recertificación de edificios de Aventura es la misma recertificación de 40 años?',
        a: 'Sí: la página del Enhanced Building Safety Inspections Program de Aventura, que enlaza los informes de ingeniería, todavía llama a la norma del condado por su nombre anterior, código de recertificación de 40 años. Es el mismo programa: la página actual lo llama Building Recertification Program, que la Building Division administra conforme a los requisitos del Condado de Miami-Dade. La página actual no indica edades: las vigentes son las del condado, en los datos de arriba.',
      },
      {
        q: '¿Cuánto tiempo tenemos para recertificar un edificio en Aventura?',
        a: 'Los plazos son los del condado y están en los datos de arriba; la página de recertificación de Aventura no indica ninguno propio, así que guíese por su carta. El paquete de Aventura dice que el informe inicial debe presentarse en cuanto esté terminado, y que las reparaciones hechas con permiso dan tiempo adicional para cumplir con un informe completo. Las páginas de Aventura no dicen qué ocurre cuando un informe de recertificación llega tarde.',
      },
    ],
    nextStep:
      'Envíe la notificación de recertificación de la Ciudad de Aventura — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. Confirmamos qué pide la Building Division y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'sunny-isles-beach',
    program: 'building-recertification',
    city: 'Sunny Isles Beach',
    place: 'Sunny Isles Beach',
    office: {
      name: 'City of Sunny Isles Beach Building Department',
      address: ['Government Center, 3rd Floor', '18070 Collins Avenue', 'Sunny Isles Beach, FL 33160'],
      phone: '(305) 947-2150',
    },
    description:
      'Recertificación de edificios en Sunny Isles Beach: la notificación, qué pide la ciudad, reparaciones y prórrogas. Un solo equipo la entrega completa.',
    heroSub:
      'El Building Department de Sunny Isles Beach enumera qué se presenta para recertificar y otorga los permisos de reparación. Un solo equipo entrega la recertificación completa, en los formularios que publica el departamento.',
    lede:
      'Sunny Isles Beach gestiona la recertificación por medio de su Building Department (el departamento de construcción de la ciudad). Su página explica qué presentan los propietarios cuando llega la notificación, qué ocurre si hacen falta reparaciones y cómo se pide una prórroga. No dice dónde se entrega el paquete; por eso lo que sigue señala tanto lo que la ciudad ha publicado como lo que deja sin precisar.',
    local: [
      { k: 'La notificación', v: 'La página de la ciudad dice que los propietarios que deben recertificar reciben una Notificación de Recertificación Requerida (Notice of Required Recertification), que inicia el proceso; más adelante escribe Notice of Required Inspection. No dice quién la envía en Sunny Isles Beach ni cómo. Conserve la carta: la página cuenta el plazo desde su fecha, y los días vigentes están en los datos de más abajo.' },
      { k: 'Presentación del informe', v: 'La lista de la ciudad sobre qué presentar incluye un informe de inspección estructural y otro de inspección eléctrica, cada uno firmado y sellado y con copias, y pide que todos los formularios lleven firma original y sello. La página no nombra un portal ni una ventanilla para el paquete, así que confirmamos con el Building Department de Sunny Isles Beach cómo quiere recibirlo.' },
      { k: 'Formularios de la ciudad', v: 'En la página de documentos del Building Department, la sección Building Recertification Forms reúne un formulario estructural, otro eléctrico y las consideraciones generales y guías. Esas guías dicen que deben usarse los formularios provistos y que no se aceptan formularios propios. La ciudad vincula ambos informes a las guías mínimas de inspección que exige la Miami-Dade County Board of Rules and Appeals (la junta de reglas y apelaciones del condado).' },
      { k: 'Qué lo acompaña', v: 'En la misma sección hay dos documentos del estacionamiento, uno sobre las barandas (guardrails) y otro sobre la iluminación; cada uno entra en el paquete únicamente donde corresponde a la propiedad.' },
      { k: 'Reparaciones', v: 'Antes de cualquier reparación, dice la ciudad, el propietario encarga la obra a un contratista con licencia de Florida y obtiene los permisos del Building Department; su página de permisos indica que toda solicitud se presenta en línea, con una cuenta del portal. Aprobada la inspección final de cada permiso, la ciudad pide un informe firmado y sellado que declare terminadas las reparaciones y seguro el edificio para seguir en uso.' },
      { k: 'Prórrogas', v: 'La página de la ciudad dice que el Building Official (el funcionario de construcción) puede conceder una prórroga, hasta un límite que la misma página indica, para presentar el informe u obtener los permisos. Hace falta una solicitud escrita del profesional, con una declaración firmada y sellada de que el edificio puede seguir ocupado mientras se recertifica. La página de Sunny Isles Beach no dice adónde enviarla.' },
      { k: 'Si se vence el plazo', v: 'Según la página de Sunny Isles Beach, la propiedad que no se recertifica a tiempo se remite a la Unsafe Structures Section (la sección de estructuras inseguras) y se abre un caso de cumplimiento. Esa sección supervisa luego el proceso, y la página enumera entre sus pasos el aviso de edificio inseguro, un Notice of Violation (aviso de infracción), la remisión a la Unsafe Structures Board y órdenes de desalojo.' },
      { k: 'Una segunda notificación', v: 'La misma página trata la recertificación del acristalamiento estructural: los propietarios de threshold buildings con una fachada exterior de acristalamiento estructural con sellador (structural sealant glazing) deben hacer inspeccionar esa fachada cada cierto tiempo, y reciben una notificación con nombre propio, la Notice of Required Recertification of Structural Glazing for Threshold Buildings. Lea el título de su carta para saber cuál de las dos tiene.' },
    ],
    faq: [
      {
        q: '¿Qué hacemos primero al recibir una Notice of Required Recertification en Sunny Isles Beach?',
        a: 'La página de la ciudad dice que con esa notificación comienza el proceso y pide a los propietarios un informe de inspección estructural y otro eléctrico. El plazo está en los datos de arriba y se cuenta desde la fecha de la notificación. Basta una foto de la carta tomada con el teléfono para que la leamos y confirmemos qué pide el Building Department de Sunny Isles Beach, y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe de recertificación en Sunny Isles Beach?',
        a: 'La página de la ciudad indica qué se presenta, pero no dónde ni cómo entregarlo: no nombra un portal, una ventanilla ni un buzón para el informe de recertificación, aunque las solicitudes de permiso en la ciudad se presentan con una cuenta en un portal en línea. La página de Sunny Isles Beach tampoco describe la revisión posterior. Confirmamos la vía con el Building Department de la ciudad antes de entregar el paquete.',
      },
      {
        q: '¿Qué pasa en Sunny Isles Beach si la recertificación se atrasa?',
        a: 'La página de la ciudad dice que la propiedad se remite a la Unsafe Structures Section y se abre un caso de cumplimiento. Menciona lo que eso puede incluir: el aviso de edificio inseguro, un Notice of Violation, la remisión a la Unsafe Structures Board, órdenes de desalojo. ¿La fecha de su notificación de Sunny Isles Beach ya quedó atrás? Envíela igual; la página dice que el proceso sigue, supervisado por esa sección.',
      },
      {
        q: '¿Podemos pedir más tiempo a Sunny Isles Beach para presentar el informe de recertificación?',
        a: 'La página de la ciudad lo contempla, dentro del límite que allí se fija: el Building Official puede conceder una prórroga para presentar el informe u obtener los permisos. La solicitud la hace por escrito el profesional y debe incluir una declaración firmada y sellada de que el edificio puede seguir ocupado mientras se recertifica. Una carta de la junta directiva por sí sola no es lo que describe la página de Sunny Isles Beach.',
      },
      {
        q: '¿La recertificación de Sunny Isles Beach es la misma recertificación de 40 años?',
        a: 'Sí: la recertificación de 40 años es el nombre anterior del programa que hoy gestiona el Building Department de Sunny Isles Beach. Su página usa ese nombre para inspecciones anteriores: dice que los edificios construidos hasta un año límite que ya tuvieron una primera inspección mediante “Miami-Dade’s 40-Year program” siguen con el calendario establecido. Hoy, para un edificio de Sunny Isles Beach, las edades vigentes son las del condado: están en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíenos su Notice of Required Recertification — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección del edificio y el año de construcción. Confirmamos qué pide el Building Department de Sunny Isles Beach y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'miami-gardens',
    program: 'building-recertification',
    city: 'Miami Gardens',
    place: 'Miami Gardens',
    office: {
      name: 'City of Miami Gardens Building Services',
      address: ['18605 NW 27th Avenue', 'Miami Gardens, FL 33056'],
      phone: '(305) 622-8027',
    },
    description:
      'Recertificación de edificios en Miami Gardens: los formularios de la ciudad, la prórroga, el portal CSS y qué entrega, completo, un solo equipo.',
    heroSub:
      'Building Services incluye la recertificación entre sus servicios y publica formularios de informe propios de la ciudad. Un solo equipo entrega completa su recertificación en Miami Gardens, en esos formularios.',
    lede:
      'El sitio de la ciudad no tiene una página propia que explique la recertificación. Lo que sí tiene: City of Miami Gardens Building Services (la oficina de construcción) incluye el programa entre sus servicios, y su página Documents and Forms guarda un grupo Recertification con sus formularios de informe, las guías del condado y una solicitud de prórroga. Los plazos del condado para un edificio de Miami Gardens están en los datos de más abajo.',
    local: [
      { k: 'La notificación', v: 'El sitio web de la ciudad no dice quién envía la Notificación de Inspección Requerida (Notice of Required Inspection) ni cómo llega al propietario. Allí la notificación aparece solo como una fecha por llenar: el formulario estructural de la ciudad pide la fecha de esa notificación, y su solicitud de prórroga tiene una línea titulada Notice Date (fecha de notificación). Conserve la carta para tener esa fecha a mano.' },
      { k: 'Formularios de la ciudad', v: 'Miami Gardens publica sus propios formularios para el informe estructural y el eléctrico — cada uno titulado con las siglas de la ciudad, CMG — en el grupo Recertification de su página Documents and Forms (documentos y formularios). Las guías de ese grupo son las del Condado de Miami-Dade; dicen que deben usarse los formularios aprobados y que no se aceptarán formularios de diseño propio.' },
      { k: 'Qué los acompaña', v: 'La ciudad publica también dos certificados para el estacionamiento — el de iluminación y el de barandas (guardrails) — que se presentan donde correspondan a la propiedad. Las guías piden una carta de presentación con cada informe, y el formulario eléctrico tiene una sección para la termografía infrarroja, donde el servicio eléctrico del edificio la exige, con el informe de termografía adjunto.' },
      { k: 'Presentación del informe', v: 'La página de estos formularios abre con una instrucción general: los formularios de construcción deben completarse y enviarse como adjuntos a una solicitud de permiso en línea en CSS, el portal Citizen Self Service de la ciudad, según se requiera. El sitio no tiene una instrucción escrita para presentar el informe de recertificación en particular, así que confirmamos con Building Services cómo se presenta el suyo antes de enviar nada.' },
      { k: 'Después de presentar', v: 'El sitio de la ciudad no describe su revisión ni dice cómo se entera el propietario del resultado. Las guías del condado que la ciudad publica dicen que los informes de recertificación pueden ser auditados, que el edificio puede ser inspeccionado a criterio del Building Official (el funcionario de construcción) y que este se reserva el derecho de revocar un informe ya aprobado.' },
      { k: 'Reparaciones', v: 'Las guías que publica Miami Gardens dicen que las reparaciones que señale el informe muy probablemente necesitarán permisos, que hacerlas sin permiso puede llevar a una infracción del código, y que reparar con permiso da tiempo adicional para cumplir. El formulario estructural de la ciudad tiene una casilla para el informe enmendado, tras completar las reparaciones, y pregunta si el edificio puede seguir ocupado mientras duran.' },
      { k: 'Prórrogas', v: 'La ciudad tiene su propio formulario, titulado Recertification Extension Request (solicitud de prórroga de la recertificación). Está redactado como una carta del propietario, su representante o el contratista que expone los motivos de la solicitud, y se jura ante notario. Una línea del formulario registra los días concedidos; el sitio no dice adónde se envía.' },
      { k: 'Nombres antiguos', v: 'La página de Building Services todavía presenta el programa como “40 Year Re-Certifications”, y la solicitud de prórroga de la ciudad todavía lo llama recertificación de 40 años. Los formularios que la ciudad publica para el informe dicen Building Recertification (recertificación de edificios), y de ese programa se trata. Las edades y los días vigentes son los del condado, en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación de recertificación en Miami Gardens?',
        a: 'El sitio web de la ciudad no dice quién la envía ni cómo. Sí muestra que City of Miami Gardens Building Services incluye la recertificación entre sus servicios, y que el formulario de la ciudad para el informe pide la fecha de la Notificación de Inspección Requerida (Notice of Required Inspection). Su carta resuelve la duda: basta una foto tomada con el teléfono para que leamos qué pide y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe de recertificación en Miami Gardens?',
        a: 'El sitio no da instrucciones propias para el informe de recertificación. La página de formularios de la ciudad dice que estos deben enviarse como adjuntos a una solicitud de permiso en línea en CSS — el portal Citizen Self Service de Miami Gardens — y las guías del condado publicadas allí dicen que el informe inicial debe entregarse a la jurisdicción local apenas esté completo. Confirmamos la vía con Building Services antes de presentar la recertificación completa.',
      },
      {
        q: '¿Cómo pedimos una prórroga de la recertificación en Miami Gardens?',
        a: 'La ciudad tiene un formulario para eso, titulado Recertification Extension Request. Es una carta del propietario, su representante o el contratista que expone los motivos, tiene una línea titulada Notice Date (fecha de notificación) y se jura ante notario. El formulario tiene además una línea para los días concedidos; el sitio no dice cuánto dura una prórroga ni adónde se entrega el formulario, así que esa pregunta es para Building Services.',
      },
      {
        q: '¿Qué pasa en Miami Gardens si el informe de recertificación se entrega tarde?',
        a: 'El sitio web de la ciudad no lo dice. Lo que la ciudad sí publica es un formulario para solicitar una prórroga. Si ya pasó la fecha de su carta, envíela igual — en cualquier caso el trabajo empieza por la inspección y el informe.',
      },
      {
        q: '¿La recertificación de Miami Gardens es la misma recertificación de 40 años?',
        a: 'Sí. La página de Building Services todavía la presenta como “40 Year Re-Certifications”, y la solicitud de prórroga de la ciudad todavía usa ese nombre, mientras que los formularios que la ciudad publica para el informe llevan el título Building Recertification Inspection Report Form. Es el programa del Condado de Miami-Dade, cuyas guías están publicadas entre los formularios de la ciudad; las edades vigentes hoy están en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe la carta sobre su edificio en Miami Gardens — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. La leemos, confirmamos qué pide Building Services y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'homestead',
    program: 'building-recertification',
    city: 'Homestead',
    place: 'Homestead',
    office: {
      name: 'City of Homestead Development Services, Building Safety',
      address: ['100 Civic Court', 'Homestead, FL 33030'],
      phone: '(305) 224-4500',
    },
    description:
      'Recertificación de edificios en Homestead: la notificación, el portal en línea, las plantillas del informe y qué entrega, completo, un solo equipo.',
    heroSub:
      'La oficina Building Safety de Homestead, en Development Services, publica la ordenanza de recertificación del condado y las plantillas del informe. Un solo equipo entrega en ellas su recertificación completa.',
    lede:
      'Homestead publica su página de recertificación dentro de City of Homestead Development Services, Building Safety, que en otras páginas llama Building Department. La página dice cómo comienza el proceso y qué deben presentar los propietarios, y enlaza las plantillas de informe aprobadas por la Board of Rules and Appeals. Sobre reparaciones, prórrogas e informes tardíos, lo que la ciudad publica es la ordenanza del condado, con su propio membrete.',
    local: [
      { k: 'La notificación', v: 'La página de Homestead dice que los propietarios reciben una Notificación de Recertificación Requerida (Notice of Required Recertification), que da inicio al proceso. La ordenanza del condado que publica la ciudad la llama Notificación de Inspección Requerida (Notice of Required Inspection), dice que la entrega el Building Official (el funcionario de construcción) y añade avisos de cortesía antes del año de aniversario de la recertificación.' },
      { k: 'Presentación del informe', v: 'La página de recertificación de Homestead no dice cómo se presenta el informe. En otras páginas la ciudad nombra su portal en línea, EPL-B.U.I.L.D, e incluye Building Recertification entre las solicitudes que los clientes pueden presentar y seguir allí. Confirmamos la vía con el Building Department de Homestead antes de entregar el paquete.' },
      { k: 'Formularios de la ciudad', v: 'La página de Homestead ofrece las guías y las plantillas de informe aprobadas por la Board of Rules and Appeals (BORA, la junta de reglas y apelaciones), y dice que han sido revisadas. Las guías generales que enlaza son un documento del propio Condado de Miami-Dade. El paquete completo va en las plantillas que indica esa página.' },
      { k: 'Qué lo acompaña', v: 'La misma lista de la página de Homestead incluye un certificado de iluminación del estacionamiento y un certificado de las barandas (guardrails) del estacionamiento; se presentan donde correspondan a la propiedad. La copia de la ordenanza del condado que publica Homestead dice que el informe lleva sello en relieve y firma, salvo que se presente por vía electrónica con una firma digital verificable.' },
      { k: 'Después de presentar', v: 'La página de recertificación de Homestead no describe cómo se revisa un informe ni cómo se comunica el resultado al propietario. Según la ciudad, su portal permite subir documentos y seguir el avance en un solo lugar. La copia de la ordenanza que publica Homestead añade que el Building Official puede revocar una recertificación si determina que el informe tergiversa las condiciones reales del edificio.' },
      { k: 'Reparaciones', v: 'La copia de la ordenanza en papel membretado de Homestead dice que el Building Official recibe una carta que indica si el edificio puede seguir ocupado con seguridad mientras se repara, y pide un informe enmendado que indique que el edificio ha sido recertificado. Las reparaciones que requieren permiso, dice, siguen el Código de Construcción y los plazos del permiso activo.' },
      { k: 'Prórrogas', v: 'La copia de la ordenanza del condado que publica Homestead dice que el Building Official puede conceder una prórroga, de duración limitada, para presentar el informe o para obtener los permisos necesarios, previa solicitud por escrito. La solicitud debe incluir una declaración firmada y sellada de que el edificio puede seguir ocupado mientras se recertifica.' },
      { k: 'Si se vence el plazo', v: 'La página de Homestead no dice qué ocurre cuando un informe llega tarde. La ordenanza del condado que publica la ciudad dice que el Building Official puede ordenar que se desconecte el servicio eléctrico si determina que la inacción deja en duda que el edificio pueda seguir ocupado con seguridad; antes debe notificar al propietario por correo certificado y fijar un aviso en el edificio.' },
    ],
    faq: [
      {
        q: '¿Qué significa la Notice of Required Recertification que recibimos de Homestead?',
        a: 'Es la notificación que da inicio al proceso. La página de la ciudad dice que la reciben los propietarios de las propiedades que requieren certificación, y que deben presentar informes escritos que certifiquen que cada edificio es seguro, estructural y eléctricamente, para seguir ocupado. El plazo para presentar en Homestead es el del condado, en los datos de arriba. Con una foto tomada con el teléfono confirmamos qué pide la ciudad y para cuándo.',
      },
      {
        q: '¿Cómo presentamos un informe de recertificación en Homestead?',
        a: 'La página de recertificación de Homestead no lo dice. Las páginas de la ciudad sobre su portal en línea, EPL-B.U.I.L.D, incluyen Building Recertification entre las solicitudes que se tramitan allí, y la página de preguntas del portal dice, en general, que las solicitudes y los documentos deben presentarse en línea, aunque los clientes aún pueden pedir ayuda en persona. Envíenos la notificación y primero confirmamos la vía con el Building Department.',
      },
      {
        q: '¿Qué edificios de Homestead no pasan por la recertificación?',
        a: 'La página de Homestead los nombra: las viviendas unifamiliares, los dúplex y los edificios pequeños que no superan el límite de ocupantes ni el de superficie que esa página indica. Para los que sí pasan por ella en Homestead, las edades son las del condado, en los datos de arriba. ¿No sabe en qué grupo está el suyo? Envíe la dirección y el año de construcción, y leemos el historial del edificio antes de responder.',
      },
      {
        q: '¿Qué ocurre en Homestead si presentamos tarde el informe de recertificación?',
        a: 'La página de Homestead no lo dice. La ordenanza del condado que publica la ciudad dice que el Building Official puede ordenar desconectar el servicio eléctrico si determina que la inacción crea incertidumbre sobre si el edificio puede seguir ocupado con seguridad, y solo tras notificar por correo certificado y fijar un aviso en el edificio. Si la fecha de su notificación de Homestead ya pasó, envíela igual — basta una foto tomada con el teléfono.',
      },
      {
        q: '¿La recertificación de Homestead es la misma recertificación de 40 años?',
        a: 'Sí. La página de recertificación de Homestead todavía la llama el proceso de recertificación de 40 años y todavía conserva el calendario anterior. Es el mismo programa: el del Condado de Miami-Dade, conforme a la ordenanza que la ciudad publica con su membrete. Las edades y los días vigentes hoy son los del condado, en los datos de arriba; guíese por ellos y por la fecha de su notificación.',
      },
    ],
    nextStep:
      '¿Tiene una Notificación de Recertificación Requerida de Homestead? Tómele una foto con el teléfono y envíenosla; si aún no la tiene, bastan la dirección y el año de construcción. Revisamos qué pide el Building Department y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'surfside',
    program: 'building-recertification',
    city: 'Surfside',
    place: 'Surfside',
    office: {
      name: 'Town of Surfside Building Department',
      address: ['9293 Harding Avenue', 'Surfside, FL 33154'],
      phone: '(305) 861-4863',
    },
    description:
      'Recertificación de edificios en Surfside: notificación por correo certificado, portal CSS, reparaciones y atrasos. Un solo equipo la entrega completa.',
    heroSub:
      'El Building Department de Surfside notifica por correo certificado y solo recibe solicitudes por su portal CSS. Un solo equipo entrega completa la recertificación de su edificio, en los formularios de informe aprobados.',
    lede:
      'En Surfside la recertificación pasa por el Town of Surfside Building Department (el departamento de construcción), que recibe los informes para su revisión y aprobación. La página de su programa explica cómo se notifica al propietario y qué ocurre si el informe llega tarde; una hoja de instrucciones aparte indica cómo se presenta: solo por el portal CSS (Customer Self Service) del municipio. Cuando el código municipal (Town Code) añade algo propio, los datos de abajo lo indican.',
    local: [
      { k: 'La notificación', v: 'Según la página del programa de Surfside, cuando un edificio debe recertificarse, el Building Department envía una notificación por correo certificado al propietario o a su representante. Conserve esa carta certificada: la página del municipio cuenta el plazo desde ella. El código municipal prevé avisos de cortesía antes de la fecha de aniversario de la recertificación, y dice que, si no se entregan, el propietario sigue obligado a recertificar.' },
      { k: 'Presentación del informe', v: 'Las instrucciones de Surfside dicen que las solicitudes de recertificación se reciben solo por el portal CSS del municipio, no en copias impresas. El tipo de solicitud que indican todavía lleva el nombre anterior del programa, de 40 años. La misma hoja pide no escribir por correo electrónico al Building Official (el funcionario de construcción) ni al Town Manager (el administrador municipal): el paquete puede no recibirse ni tramitarse.' },
      { k: 'Formularios de la ciudad', v: 'El Building Recertification Package del sitio del municipio abre con las guías generales (General Considerations and Guidelines) del Condado de Miami-Dade, que exigen los formularios de informe aprobados y no aceptan formularios propios. Las instrucciones de Surfside empiezan por una solicitud de permiso, impresa y rellenada, y la página de formularios del Building Department dice que sus formularios se pueden rellenar en línea y que se acepta la notarización electrónica.' },
      { k: 'Los archivos', v: 'Las instrucciones de Surfside piden el paquete de recertificación en un archivo PDF aparte, separado por disciplina. No se tramitan archivos cifrados ni con firmas de terceros: los revisores de planos deben poder hacer anotaciones en ellos. La página del programa pide sello en relieve y firma; el sitio del municipio no dice cómo cumple eso un PDF subido al portal, así que lo confirmamos con el Building Department.' },
      { k: 'Después de presentar', v: 'Tramitada la solicitud, el técnico de permisos del municipio envía por correo electrónico un recibo con el número de solicitud. El informe pasa al Building Department para su revisión y aprobación; revisado el paquete, el personal administrativo se comunica con el solicitante por la carta de recertificación, cuya emisión es el último paso de las instrucciones de Surfside. El sitio del municipio no indica cuánto tarda la revisión.' },
      { k: 'Reparaciones', v: 'Según la página del programa de Surfside, las reparaciones o modificaciones que la inspección considere necesarias deben cumplir con el Florida Building Code, y el plazo del propietario para hacerlas se cuenta desde la notificación de inspección requerida. El plazo que rige hoy para un edificio de Surfside está en los datos de más abajo. Esa página no habla de permisos para esas reparaciones ni de un informe enmendado posterior.' },
      { k: 'Prórrogas', v: 'La página del programa de Surfside y sus instrucciones de presentación no dicen nada sobre prórrogas. El código municipal sí: el Building Official puede conceder una prórroga de duración fija para la recertificación de edificios, y renovarla a su criterio. El sitio del municipio no explica cómo se pide, así que esa pregunta se le hace al Building Department.' },
      { k: 'Si se vence el plazo', v: 'Según la página del programa de Surfside, un informe tardío conlleva una infracción de construcción. El Notice of Violation (aviso de infracción) se coloca en el edificio y se envía al propietario por correo certificado; sin respuesta, va a audiencia ante el Special Master (el magistrado especial) del municipio. Si el Building Official considera insegura la estructura, el asunto pasa a la Unsafe Structures Board (junta de estructuras inseguras) del condado.' },
    ],
    faq: [
      {
        q: '¿Cómo presentamos el informe de recertificación en Surfside?',
        a: 'Por el portal CSS del municipio, y solo por ahí: las instrucciones de Surfside no admiten copias impresas y piden no escribir por correo electrónico al Building Official ni al Town Manager. En el portal lo primero es registrar una cuenta; la solicitud va en el tipo de recertificación de edificios, con el paquete en un archivo PDF aparte. La recertificación completa que entregamos para un edificio de Surfside va en los formularios de informe que pide el sitio del municipio.',
      },
      {
        q: '¿Cuánto tiempo tenemos para presentar el informe de recertificación en Surfside?',
        a: 'Para un edificio de Surfside los días son los del condado y están en los datos de arriba. La página del programa cuenta el plazo del propietario desde la notificación que el Building Department envía por correo certificado, así que conserve esa carta y su fecha. El código municipal permite además que el Building Official conceda una prórroga y la renueve a su criterio; el sitio del municipio no dice cómo se pide.',
      },
      {
        q: '¿Qué pasa en Surfside si el informe de recertificación se entrega tarde?',
        a: 'La página del programa dice que se emite una infracción de construcción: el Notice of Violation se coloca en el edificio y se envía por correo al propietario. Si este no responde, la infracción va a audiencia ante el Special Master del municipio de Surfside; si el Building Official considera insegura la estructura, el asunto pasa a la Unsafe Structures Board del condado. Si ya pasó la fecha de su notificación de Surfside, envíenosla de todos modos.',
      },
      {
        q: '¿La recertificación de Surfside es la misma recertificación de 40 años?',
        a: 'Sí. La página del municipio todavía se titula 40-Year Recertification Program, y su texto conserva la edad anterior para la primera recertificación. En su parte superior, la misma página enlaza a las nuevas reglas de recertificación de condominios adoptadas por el Condado de Miami-Dade. Hoy, para un edificio de Surfside, las edades vigentes son las del condado, en los datos de arriba, no la que figura en la página del municipio.',
      },
      {
        q: '¿Tenemos que compartir el informe de recertificación con los residentes de nuestro condominio en Surfside?',
        a: 'El código municipal dice que sí. El propietario de un edificio multifamiliar, o la asociación del condominio, debe hacer llegar todo informe que reciba del ingeniero a todos los propietarios y residentes del edificio. La misma sección dispone que los informes y comentarios del ingeniero lleguen al Building Official y a todos los propietarios y residentes cuando se entregan al propietario. Esa disposición está en el código de Surfside, no en la página de su programa.',
      },
    ],
    nextStep:
      'Envíenos la carta certificada del Building Department de Surfside — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección del edificio y el año de construcción. Leemos qué pide el municipio de Surfside y para cuándo, y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'key-biscayne',
    program: 'building-recertification',
    city: 'Key Biscayne',
    place: 'Key Biscayne',
    office: {
      name: 'Village of Key Biscayne Building, Zoning and Planning Department',
      address: ['88 W. McIntyre St., Suite 250', 'Key Biscayne, FL 33149'],
      phone: '(305) 365-5512',
    },
    description:
      'Recertificación de edificios en Key Biscayne: cómo notifica la Villa, qué pide su página para el informe y qué entrega, completo, un solo equipo.',
    heroSub:
      'La Villa de Key Biscayne envía la notificación por correo certificado, y el informe lo recibe su Building Official (el funcionario de construcción). Un solo equipo entrega la recertificación completa.',
    lede:
      'En Key Biscayne la recertificación la lleva la propia Villa, a través del Village of Key Biscayne Building, Zoning and Planning Department (su departamento de construcción, zonificación y planificación). Su página dice que la Villa sigue el proceso establecido por el Condado de Miami-Dade, y que sigue los códigos de construcción del estado y del condado. A continuación, lo que dicen las páginas de la propia Villa, tema por tema.',
    local: [
      { k: 'La notificación', v: 'La Villa emite ella misma la notificación y la envía por correo certificado — “para asegurar que se reciba”, dice su página — a los propietarios o a la administración del edificio. Por eso el sobre puede ir dirigido a la administración y no a los propietarios. La página no da un número de días para el informe; los plazos del condado están en los datos de más abajo.' },
      { k: 'Presentación del informe', v: 'La página de la Villa dice que el propietario del edificio debe presentar un informe de recertificación por escrito ante el Building Official. No dice por qué vía — en papel, por correo electrónico o por el Citizen Portal de la Villa — así que ese punto lo define la notificación o el Building Department de la Villa.' },
      { k: 'Qué lo acompaña', v: 'La página de la Villa pide que cada hoja del informe estructural y del informe eléctrico esté firmada y sellada. Si en la propiedad hay más de un edificio, el informe debería incluir un plano del sitio o una copia del plano de agrimensura (survey) que muestre dónde está cada edificio, con el edificio que se recertifica claramente identificado.' },
      { k: 'Formularios de la Villa', v: 'En la página Forms and Resources (formularios y recursos) de la Villa están las guías mínimas de inspección para la recertificación estructural, las guías equivalentes para la recertificación eléctrica y una certificación de cumplimiento de las barandas (guardrails) del estacionamiento. Esa certificación entra en un paquete de Key Biscayne solo donde corresponda a la propiedad.' },
      { k: 'Después de presentar', v: 'Una vez presentado el informe, la Villa lo audita para comprobar que cumple con el Código del Condado de Miami-Dade. Si el informe es aceptable, la Villa emite lo que su página llama la carta de recertificación. La página de la Villa no dice cuánto tarda esa auditoría.' },
      { k: 'Reparaciones', v: 'Si las conclusiones del informe identifican incumplimientos de los códigos de construcción de Miami-Dade o de Florida, la Villa exige al propietario o a la administración que completen las reparaciones. Su página dice que el ingeniero o arquitecto que contrataron vuelve a inspeccionar el trabajo y entrega un informe actualizado, que la Villa audita a su vez.' },
      { k: 'Si se vence el plazo', v: 'La página de la Villa no habla de un informe tardío como tal. Dice que, si no se completan las reparaciones ni llega el informe actualizado, la Villa puede dar parte de la estructura a la Unsafe Structures Board (junta de estructuras inseguras) del Condado de Miami-Dade, y que su Building Official determina, caso por caso, si se remite a esa junta un edificio que el condado define como estructura insegura.' },
      { k: 'Nombres antiguos', v: 'La página de recertificación de la Villa todavía describe el programa con el calendario anterior, y su Citizen Portal todavía tiene un tipo de expediente llamado “40 Year Recertification”, el nombre anterior del programa. Las edades y los días vigentes en Key Biscayne son los del condado y están en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación de recertificación en Key Biscayne?',
        a: 'La propia Villa de Key Biscayne. Su página dice que emite la notificación a los propietarios o a la administración del edificio por correo certificado, y que les ofrece apoyo durante todo el proceso enviando las notificaciones que establece el Código del Condado de Miami-Dade. Envíenos la notificación — basta una foto tomada con el teléfono — y confirmamos qué pide la Villa y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe de recertificación en Key Biscayne?',
        a: 'La página de la Villa solo dice que el informe escrito se presenta ante el Building Official. Su portal, el Building, Zoning and Planning Citizen Portal, recibe por vía electrónica solicitudes de permiso y planos de construcción, que también se siguen aceptando en papel; pero ni el portal ni la página dicen que un informe de recertificación se presente así. Confirmamos la vía con el Building Department de la Villa antes de entregar el paquete.',
      },
      {
        q: '¿Qué edificios de Key Biscayne tienen que recertificarse?',
        a: 'La página de la Villa dice que el requisito del condado, al que Key Biscayne está sujeta, abarca todos los edificios salvo viviendas unifamiliares, dúplex y estructuras menores, que la página define por su carga de ocupación y su área bruta. La edad a la que les toca en Key Biscayne está en los datos de arriba. ¿No sabe si le toca al suyo? Envíe su dirección y el año en que se construyó.',
      },
      {
        q: '¿Qué pasa en Key Biscayne si la inspección concluye que nuestro edificio no es seguro?',
        a: 'Si el ingeniero o arquitecto contratado por el propietario o la administración considera que el edificio no es seguro para seguir ocupado, la página de la Villa dice que el Código de Construcción de Florida (Florida Building Code) obliga a la Villa a declarar el edificio inseguro y a evacuarlo de inmediato. Cuando lo que el informe encuentra son incumplimientos de los códigos de construcción, la Villa exige reparaciones y luego audita un informe actualizado.',
      },
      {
        q: '¿La recertificación de Key Biscayne es la misma recertificación de 40 años?',
        a: 'Sí. “Recertificación de 40 años” es el nombre anterior del programa, y la página de la Villa todavía lo usa. Esa misma página dice que Key Biscayne está sujeta al requisito del Condado de Miami-Dade y que sigue el proceso que el condado establece, así que las edades y los plazos que valen son los del condado: los de los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe la notificación de la Villa de Key Biscayne — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año de construcción. Confirmamos qué espera de su edificio el Building Department de la Villa y respondemos con una propuesta para la recertificación completa.',
  },
  {
    slug: 'fort-lauderdale',
    program: 'broward-bsip',
    city: 'Fort Lauderdale',
    place: 'Fort Lauderdale',
    office: {
      name: 'City of Fort Lauderdale Development Services Department',
      phone: '(954) 828-5932',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Fort Lauderdale: carta certificada, LauderBuild y un equipo que lo entrega completo.',
    heroSub:
      'El Building Official de Fort Lauderdale notifica por correo certificado; los informes se presentan en LauderBuild Plan Room, y un solo equipo entrega completos la inspección y el informe del BSIP.',
    lede:
      'En el sitio de Fort Lauderdale, el Programa de Inspección de Seguridad de Edificios (BSIP) de Broward figura dentro del City of Fort Lauderdale Development Services Department (el departamento de servicios de desarrollo), y la página del programa da como contacto al Building Safety Program. La notificación llega del Building Official (el funcionario de construcción) por correo certificado, y toda la presentación es electrónica, por LauderBuild Plan Room. Esto dicen las páginas de Fort Lauderdale, paso a paso.',
    local: [
      { k: 'La notificación', v: 'Según la página de Fort Lauderdale, la notificación la envía el Building Official por correo certificado, al propietario, a la asociación o a ambos, en el año en que al edificio le corresponde la inspección. Consérvela: el formulario de presentación de la ciudad pide el número de seguimiento de esa notificación.' },
      { k: 'Presentación del informe', v: 'Fort Lauderdale solo recibe la presentación por vía electrónica — su página dice que ya no se aceptan entregas en papel. Los documentos se presentan en LauderBuild Plan Room, con la solicitud que la ciudad llama Building Safety Inspection Program Application (BSIP). Cada uno se sube como archivo aparte; la página pide no combinarlos.' },
      { k: 'Formularios de la ciudad', v: 'La página de la ciudad enumera los formularios que deben completarse y adjuntarse a la solicitud: su propio formulario de presentación (Building Safety Inspection Submittal Form), uno de inspección estructural y otro de inspección eléctrica. El estructural que enlaza lleva el encabezado de BORA, la Board of Rules and Appeals del condado. La lista de tipos de documento de Plan Room exige firma y sello digitales en ambos formularios de inspección.' },
      { k: 'El formulario de presentación', v: 'El formulario de presentación de Fort Lauderdale pide el número de folio de la propiedad y la superficie del edificio en pies cuadrados. Se marca como presentación inicial o como Repairs Required Submittal (presentación con reparaciones requeridas), que pide además los números de permiso de las reparaciones. Su lista de verificación nombra los formularios del informe estructural y del informe eléctrico como parte del paquete.' },
      { k: 'Firmas y archivos', v: 'Fort Lauderdale exige que todos los documentos lleven firma y sello digitales. La Digital Signature Policy (la política de firma digital de la ciudad) no admite firmas digitales autofirmadas y nombra las autoridades de certificación que aprueba para los certificados digitales. Las normas generales de Plan Room piden archivos PDF y excluyen los cifrados o protegidos con contraseña.' },
      { k: 'Después de presentar', v: 'Una vez presentada la solicitud, la página de Fort Lauderdale menciona un solo paso: un aviso por correo electrónico cuando la solicitud se acepta. No dice cómo se comunica al propietario el resultado de la revisión ni qué documento cierra el caso. Según las reglas generales de Plan Room, con el paquete ya enviado a revisión no se pueden subir más documentos sin permiso del personal de la ciudad.' },
      { k: 'Reparaciones', v: 'Cuando hacen falta reparaciones, la página de Fort Lauderdale pide una carta escrita, firmada y sellada, dirigida tanto al propietario como al Building Official, que indique si el edificio puede seguir ocupado con seguridad mientras se hacen. Al terminarlas, según la página, el profesional con licencia que hizo la inspección vuelve a inspeccionar y entrega un informe enmendado, con una carta firmada y sellada que confirma que todas las reparaciones están completas.' },
      { k: 'Si se vence el plazo', v: 'La página del programa de Fort Lauderdale no dice qué ocurre cuando un informe llega tarde: no nombra ningún órgano que celebre audiencias ni describe una prórroga del plazo para presentar. La única salvedad que menciona es la de las reparaciones, cuyo plazo — en los datos de más abajo — rige salvo que el Building Official indique otra cosa. Lo demás lo resuelven la notificación y el Building Safety Program.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación del BSIP en Fort Lauderdale y cómo llega?',
        a: 'El Building Official de Fort Lauderdale, por correo certificado. La página de la ciudad dice que propietarios y asociaciones la reciben en el año en que a su edificio le corresponde la inspección, y el formulario de presentación de la ciudad pide después el número de seguimiento de esa notificación. Nos basta una foto de la notificación, tomada con el teléfono, para leerla y confirmar qué pide Fort Lauderdale y para cuándo.',
      },
      {
        q: '¿Cómo presentamos un informe del BSIP en Fort Lauderdale?',
        a: 'Por LauderBuild Plan Room; Fort Lauderdale ya no acepta papel. La página de LauderBuild incluye una computadora de escritorio entre sus requisitos mínimos — no admite el envío desde dispositivos móviles — y sus preguntas frecuentes, escritas para expedientes de permisos, dicen que Plan Room solo abre un expediente a una cuenta de LauderBuild cuyo contacto figure en él. La inspección y el informe completos del BSIP que entregamos van en los formularios que enumera la página de Fort Lauderdale.',
      },
      {
        q: '¿Cuánto tiempo tenemos para presentar el informe del BSIP en Fort Lauderdale?',
        a: 'Los dos plazos son los de Broward y están en los datos de arriba: el de presentar el informe y el de las reparaciones. Sobre las reparaciones, la página de Fort Lauderdale añade que ese plazo rige salvo que el Building Official indique otra cosa. La página no describe ninguna forma de pedir más tiempo para presentar, así que lo que corresponde a su edificio lo resuelven la notificación certificada y el Building Safety Program.',
      },
      {
        q: '¿Qué edificios están exentos del BSIP en Fort Lauderdale?',
        a: 'La página de Fort Lauderdale enumera lo que no está sujeto al programa: edificios del gobierno federal y estatal, edificios en tierras tribales soberanas, edificios escolares que administra la Broward County School Board, edificios residenciales pequeños y estructuras pequeñas (la página fija sus límites de tamaño), ciertos townhouses, definidos por su forma de propiedad, y ferrocarriles e instalaciones relacionadas. Si la notificación de Fort Lauderdale llegó a un edificio que cree incluido en esa lista, envíenosla con la dirección.',
      },
      {
        q: '¿Cómo corregimos un informe del BSIP ya presentado en Fort Lauderdale?',
        a: 'Para las correcciones o nuevas presentaciones de informes antiguos — la página de Fort Lauderdale da la fecha de corte — el informe corregido se envía por correo electrónico a las direcciones que allí aparecen, no con una solicitud nueva, que según la página genera expedientes duplicados. La página no da instrucciones para un informe creado después de esa fecha; según las reglas generales de Plan Room, un paquete ya enviado a revisión solo admite más documentos con permiso del personal de la ciudad.',
      },
    ],
    nextStep:
      'Envíe la notificación certificada del Building Official de Fort Lauderdale — basta una foto con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Confirmamos qué pide la ciudad y para cuándo, y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
  {
    slug: 'hollywood',
    program: 'broward-bsip',
    city: 'Hollywood',
    place: 'Hollywood',
    office: {
      name: 'City of Hollywood Building Division',
      address: ['Development Services Hub, Second Floor Library', 'City Hall Circle, 2600 Hollywood Blvd', 'Hollywood, FL 33020'],
      phone: '(954) 921-3335',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Hollywood: la notificación, el portal ACA y lo que entrega, completo, un solo equipo.',
    heroSub:
      'Hollywood recibe los informes nuevos del BSIP únicamente por su portal Accela Citizen Access, y los revisa su Building Division; un solo equipo entrega completos la inspección y el informe.',
    lede:
      'En Hollywood, el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por la City of Hollywood Building Division. El Building Official (el funcionario de construcción) emite la notificación, el informe entra por el portal Accela Citizen Access (ACA) y lo revisan los Plan Reviewers (los revisores de planos) de la ciudad. Esto es lo que dicen sus páginas, punto por punto; los plazos del condado están más abajo.',
    local: [
      { k: 'La notificación', v: 'La página de Hollywood dice que el Building Official emite una Notificación de Inspección Requerida (Notice of Required Inspection) dirigida al propietario del edificio o a la asociación. La Board of Rules and Appeals (la junta de normas y apelaciones) envía a la ciudad las listas de propiedades que deben inspeccionarse, y Hollywood las publica en esa misma página en cuanto las recibe.' },
      { k: 'Presentación del informe', v: 'La página de Hollywood dice que todos los informes nuevos del BSIP deben presentarse por el portal Accela Citizen Access (ACA) de la Ciudad de Hollywood. Dice que ya no se aceptan copias impresas ni envíos por correo, y que todas las firmas requeridas deben ser digitales y validarse en ACA: no se aceptan firmas manuscritas ni escaneadas.' },
      { k: 'Antes de presentar', v: 'Hollywood fija un paso previo. El ingeniero o el arquitecto responsable del informe debe estar registrado en ACA y aprobado por el personal de recepción de la ciudad antes de que el informe se presente, y debe quedar seleccionado en ACA como el profesional de diseño (design professional) de la solicitud. Si ese profesional no aparece en ACA, la página dice que el informe no puede presentarse.' },
      { k: 'Formularios de la ciudad', v: 'El paquete del informe que publica la ciudad empieza con una lista de verificación propia de Hollywood, la Transmittal Checklist del informe del BSIP. Pide un informe estructural y un informe eléctrico vigentes del programa del Condado de Broward, y que cada uno indique si se requieren reparaciones o no. La lista añade que varias estructuras independientes no pueden combinarse en un solo informe.' },
      { k: 'Qué lo acompaña', v: 'Para cada edificio, la página de Hollywood pide el informe del BSIP ya completado, que incluye la inspección estructural y la eléctrica, junto con fotos del estado actual. Si se requieren reparaciones, pide además una descripción o el alcance de los trabajos y fotos a color, en PDF, de la zona que las requiere.' },
      { k: 'Después de presentar', v: 'La Building Division de Hollywood revisa los informes. En el apartado de los edificios que no requieren reparaciones, la página de la ciudad dice que se emitirá un Certificado si, tras la revisión de los Plan Reviewers, los documentos presentados cumplen los requisitos. La página no dice cómo se le comunica el resultado al propietario; eso se consulta con la Building Division.' },
      { k: 'Reparaciones', v: 'Si el informe del BSIP señala trabajos que requieren un permiso de construcción, la página de Hollywood dice que el Plan Reviewer de la ciudad lo pide una vez presentado y revisado el informe, y que también se solicita por ACA. La lista de la ciudad dice que puede requerirse un permiso según la magnitud de las reparaciones, y pide su número cuando el informe se presenta tras las reparaciones requeridas.' },
      { k: 'Nombres antiguos', v: 'Una sección de la página de Hollywood todavía lleva el nombre anterior del programa, el de 40 años, y el calendario de entonces. El modelo de notificación que publica la ciudad repite ese calendario y habla de enviar el informe por correo o entregarlo. Las edades y los días vigentes son los del condado, que figuran más abajo; para presentar, los requisitos de la página indican el portal ACA.' },
    ],
    faq: [
      {
        q: '¿Cómo presentamos el informe del BSIP en Hollywood?',
        a: 'Por el portal Accela Citizen Access (ACA) de la Ciudad de Hollywood: la página de la ciudad dice que ya no se aceptan copias impresas ni envíos por correo. La página de permisos de la ciudad dice que Hollywood también pasó a ACA para todas las solicitudes nuevas de permisos. Antes de presentar el informe, el ingeniero o el arquitecto responsable tiene que estar registrado y aprobado en ACA.',
      },
      {
        q: '¿Podemos pedir más tiempo para el BSIP en Hollywood?',
        a: 'La página de Hollywood no describe ningún trámite para eso. Una hoja de preguntas y respuestas de la Board of Rules and Appeals, enlazada desde esa página, dice que hay que dirigirse al Building Official de la ciudad o del condado donde está la propiedad para posponer una inspección o para ampliar el plazo de las reparaciones. Para un edificio en Hollywood, ese es el Building Official de la ciudad.',
      },
      {
        q: '¿Qué hacemos con la notificación del BSIP si somos propietarios de una unidad en un condominio de Hollywood?',
        a: 'El modelo de carta de notificación que publica Hollywood trae una nota dirigida a cada propietario de unidad. Dice que la notificación es solo informativa, para avisarle de que a su edificio le corresponde el BSIP, y le pide que hable con el administrador de la propiedad o con la junta directiva del condominio sobre las inspecciones de su unidad y de las áreas comunes. Si usted integra esa junta en Hollywood, envíenos la carta.',
      },
      {
        q: '¿Qué pasa en Hollywood si no presentamos el informe del BSIP a tiempo?',
        a: 'La página de Hollywood habla de edificios en incumplimiento, no de informes fuera de plazo. Entre las medidas que la ciudad dice estar tomando, indica que a esos edificios se les podría colocar una Notice of Violation (notificación de infracción), y que el propietario que no responda a ella podría ser remitido al Special Magistrate (el magistrado especial). Si se determina que el edificio es inseguro, el caso podría pasar a la Broward County Unsafe Structures Board (la junta de estructuras inseguras).',
      },
      {
        q: '¿El BSIP de Hollywood es la misma recertificación de 40 años?',
        a: 'Sí. Una sección de la página de Hollywood todavía llama al programa por su nombre anterior, el de 40 años, mientras que su sección sobre la presentación de los informes lo llama Building Safety Inspection Program, o BSIP. Si su carta de Hollywood usa el nombre antiguo, envíenosla — basta una foto tomada con el teléfono — y confirmamos qué pide la Building Division y para cuándo.',
      },
    ],
    nextStep:
      'Envíenos su Notificación de Inspección Requerida de Hollywood — basta una foto con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Confirmamos qué pide la Building Division de Hollywood y para cuándo, y respondemos con una propuesta para el BSIP completo, inspección e informe.',
  },
  {
    slug: 'pompano-beach',
    program: 'broward-bsip',
    city: 'Pompano Beach',
    place: 'Pompano Beach',
    office: {
      name: 'City of Pompano Beach Building Department',
      address: ['Pompano City Hall, 3rd Floor', '100 West Atlantic Boulevard', 'Pompano Beach, FL 33060'],
      phone: '(954) 786-4669',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Pompano Beach: la carta certificada, adónde va el informe y el formulario propio.',
    heroSub:
      'El Building Official de Pompano Beach notifica por correo certificado y recibe los informes. Un solo equipo entrega completos la inspección y el informe del BSIP, en los formularios que indica la ciudad.',
    lede:
      'En Pompano Beach, el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por el Building Official (el funcionario de construcción) del Building Department de la ciudad. La página del programa trata la notificación, el informe, las reparaciones y las prórrogas, e incluye un formulario propio, la Re-Inspection Affidavit (declaración jurada de reinspección). A continuación, lo que dicen las páginas de la ciudad y ese formulario; los plazos del condado están en los datos de más abajo.',
    local: [
      { k: 'La notificación', v: 'La página de Pompano Beach dice que el Building Official envía la Notificación de Inspección Requerida (Notice of Required Inspection) por correo certificado al propietario o a la asociación de cada edificio que debe inspeccionarse ese año calendario. Las notificaciones salen cada año, dentro de las fechas que da la página. La página cuenta el plazo para presentar desde esa notificación; el plazo está en los datos de más abajo.' },
      { k: 'Presentación del informe', v: 'La página del programa de Pompano Beach dice que el informe escrito se presenta al Building Official e incluye el formulario de informe de inspección de seguridad, estructural y eléctrica, de la Broward County Board of Rules and Appeals (la junta de reglas y apelaciones del condado). No nombra portal, correo electrónico ni formato de archivo para ese informe, así que confirmamos con el Building Department cómo entregarlo antes de presentarlo.' },
      { k: 'Formularios de la ciudad', v: 'Con el informe, la página de Pompano Beach pide el formulario de informe estructural y eléctrico de la Board of Rules and Appeals. La página del programa incluye además un formulario propio de la ciudad: la Building Safety Inspection Program Re-Inspection Affidavit, con el membrete de su Building Inspections Division. Según la página de formularios del departamento, sirve para reinspeccionar un edificio que pasa por una inspección de seguridad requerida.' },
      { k: 'Después de presentar', v: 'La página de Pompano Beach no describe cómo se revisa un informe ni qué cierra el caso. Sí enlaza al estado del caso en el servicio en línea de Code Compliance (cumplimiento de códigos) de la ciudad, que muestra un caso y su próximo paso. La página de contacto del Building Department incluye un grupo de Building Safety Compliance, con un inspector jefe, un oficial de cumplimiento y un puesto de secretaría.' },
      { k: 'Reparaciones', v: 'Cuando hacen falta reparaciones, la página de Pompano Beach pide una carta firmada y sellada para el propietario y el Building Official sobre si el edificio puede seguir ocupado con seguridad entretanto. Esa carta tiene una vigencia limitada; se emite otra si las reparaciones continúan. Terminadas las reparaciones, se reinspeccionan las áreas señaladas en el informe original y sigue un informe enmendado.' },
      { k: 'La Re-Inspection Affidavit', v: 'La declaración jurada de Pompano Beach registra la reinspección posterior a las reparaciones. Cita el informe original por su número de permiso o caso de la ciudad y marca las reparaciones como completadas con los permisos de restauración que menciona, o como trabajos menores que no requirieron permiso. Se entrega al Building Official por vía electrónica, con firma y sello electrónicos, o en mano con sello en relieve o de tinta.' },
      { k: 'Prórrogas', v: 'Según la página de Pompano Beach, el Building Official puede prorrogar, hasta un límite, el plazo para presentar el informe o para obtener los permisos. La solicitud la hace por escrito el profesional con licencia, con una declaración firmada y sellada de que el edificio puede seguir ocupado. Las reparaciones que necesiten más tiempo pueden recibir otro plazo, con la aprobación del Building Official, mientras el permiso de reparación siga activo.' },
      { k: 'Quién está exento', v: 'La página de Pompano Beach enumera como exentos los edificios federales y del Estado de Florida, los construidos en tierras tribales soberanas, las escuelas de la Broward County School Board, los ferrocarriles, ciertos townhouses y, dentro de los límites que indica, viviendas pequeñas y estructuras menores. Añade que las terrazas elevadas, balcones, muelles y malecones (seawalls) forman parte del programa cuando están unidos a una estructura o la sostienen.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación del Programa de Inspección de Seguridad de Edificios en Pompano Beach?',
        a: 'El Building Official de la ciudad. La página de Pompano Beach dice que la Notificación de Inspección Requerida (Notice of Required Inspection) llega por correo certificado al propietario o a la asociación, y que el informe vuelve al Building Official. Nos basta una foto de esa notificación, tomada con el teléfono, para leerla y confirmar qué pide el Building Official y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe del BSIP en Pompano Beach?',
        a: 'La página de Pompano Beach dice que el informe se presenta al Building Official, con el formulario de informe estructural y eléctrico de la Board of Rules and Appeals. No indica portal, correo electrónico ni formato de archivo. La Re-Inspection Affidavit de la ciudad sí trae una instrucción de entrega — por vía electrónica o en mano — pero se refiere a esa declaración jurada, no al informe. Por eso preguntamos al Building Department cómo quiere recibir el informe antes de presentar nada.',
      },
      {
        q: '¿Pompano Beach tiene formularios propios para el BSIP?',
        a: 'Tiene uno para la reinspección que sigue a las reparaciones: la Re-Inspection Affidavit, que figura en la página del programa de la ciudad y lleva el membrete de su Building Inspections Division. Para el informe en sí, la página de Pompano Beach nombra el formulario de informe estructural y eléctrico de la Broward County Board of Rules and Appeals. La inspección y el informe completos del BSIP que entregamos van en los formularios que nombra esa página.',
      },
      {
        q: '¿Podemos obtener más tiempo para el informe del BSIP o para las reparaciones en Pompano Beach?',
        a: 'La página de Pompano Beach lo contempla. El Building Official puede conceder una prórroga, con el tope que fija la página, para presentar el informe o para obtener los permisos cuando el profesional con licencia la pide por escrito y declara, con firma y sello, que el edificio puede seguir ocupado. Si las reparaciones no pueden terminarse a tiempo, puede aprobarse un nuevo plazo mientras el permiso de reparación siga activo. Los plazos del condado están en los datos de arriba.',
      },
      {
        q: '¿Qué pasa en Pompano Beach si el informe del BSIP se entrega tarde?',
        a: 'La página del programa de Pompano Beach no lo dice. Trata la notificación, el informe, las reparaciones y las prórrogas, y no dice nada sobre lo que sigue a un informe entregado tarde. ¿Ya pasó la fecha de su notificación? Envíenosla de todos modos, y leemos qué pide el Building Official.',
      },
    ],
    nextStep:
      'Envíe la notificación del Building Official de Pompano Beach — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Leemos qué pide Pompano Beach y para cuándo, y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
  {
    slug: 'hallandale-beach',
    program: 'broward-bsip',
    city: 'Hallandale Beach',
    place: 'Hallandale Beach',
    office: {
      name: 'City of Hallandale Beach Building Division',
      address: ['400 South Federal Highway', 'Hallandale Beach, FL 33009'],
      phone: '(954) 457-2220',
    },
    description:
      'BSIP en Hallandale Beach: cómo notifica la Building Division, cómo se presenta el informe en línea y qué entrega, completo, un solo equipo.',
    heroSub:
      'La Building Division de Hallandale Beach envía las notificaciones y el informe entra por el Self-Service Portal de la ciudad; un solo equipo entrega completos la inspección y el informe del BSIP.',
    lede:
      'En Hallandale Beach el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por la City of Hallandale Beach Building Division (la división de construcción). Cada año la Board of Rules and Appeals (la junta de reglas y apelaciones del condado) entrega a cada jurisdicción su lista de edificios por inspeccionar; el Building Official (el funcionario de construcción) escribe entonces al propietario o a la asociación, y el informe vuelve por el portal en línea de la ciudad.',
    local: [
      { k: 'La notificación', v: 'Según la página del programa, la Board of Rules and Appeals del Condado de Broward entrega cada año a cada jurisdicción la lista de edificios por inspeccionar. Después, el Building Official notifica al propietario o a la asociación por correo certificado con acuse de recibo. Un aviso por correo electrónico enlazado desde esa página dice que la Building Division envía las notificaciones a las propiedades de su lista.' },
      { k: 'Presentación del informe', v: 'La página del programa tiene un botón para presentar el informe de la inspección de seguridad. Abre el Hallandale Beach Self-Service Portal, cuya página de inicio tiene un paso para entrar con una cuenta existente o crear una nueva. La página del programa no indica otra forma de entregar el informe.' },
      { k: 'Formularios de la ciudad', v: 'Según la página Inspections de Hallandale Beach, el informe escrito incluye los formularios estructural y eléctrico de la Board of Rules and Appeals. La página de formularios de la Building Division publica los dos formularios de inspección del programa, sus guías y la política de esa junta. Añade una regla general, no escrita para el BSIP: todo documento con firma y sello digitales requiere verificación por un tercero.' },
      { k: 'Después de presentar', v: 'Una vez revisado el informe y hechas las reparaciones que correspondan, dice la página del programa, el edificio queda certificado como seguro para seguir ocupado. Las preguntas frecuentes de la ciudad remiten a una lista, en su sitio web, de las propiedades inspeccionadas y de si cada una aprobó o no. Las páginas de Hallandale Beach no dicen cómo se comunica el resultado al propietario.' },
      { k: 'Reparaciones', v: 'La página del programa dice que el informe señala las deficiencias, y que estas exigen un permiso de reparación. El modelo de notificación publicado allí añade que las reparaciones siguen el Florida Existing Building Code y el National Electrical Code, y que las incidentales, sin riesgo para la vida, se terminan en un plazo que fija el profesional que inspecciona y aprueba el Building Official.' },
      { k: 'Prórrogas', v: 'Las preguntas frecuentes de la ciudad dicen que una propiedad que no cumplió el plazo debe solicitar una prórroga, que el Building Official concede según la situación y la complejidad de la obra. Para las reparaciones, el modelo de notificación dice que el plazo puede ampliarse si el profesional que inspecciona fija uno, el Building Official lo aprueba y se mantiene activo un permiso de construcción. Ninguno dice cómo se solicita.' },
      { k: 'Si se vence el plazo', v: 'Según las preguntas frecuentes de la ciudad, si un informe encuentra problemas críticos de seguridad, o si una propiedad está en incumplimiento — sin gestiones para pedir permisos —, el Building Official puede recomendar a la Unsafe Structures Board (la junta de estructuras inseguras) que la estructura se declare insegura. El modelo de notificación dice que un edificio sin certificar se expone a un procedimiento por estructura insegura conforme al Florida Building Code.' },
      { k: 'Quién está exento', v: 'La página del programa enumera como exentos: viviendas unifamiliares y bifamiliares, edificios del gobierno de Estados Unidos y del Estado de Florida, escuelas de la Broward County School Board y edificios en reservas indígenas; también deja fuera los que no llegan a la superficie que indica. Las preguntas frecuentes de la ciudad añaden que solo se exime de la inspección si se demolió el edificio entero.' },
    ],
    faq: [
      {
        q: '¿Podemos entregar el informe del BSIP en persona o por correo electrónico en Hallandale Beach?',
        a: 'La página del programa indica una sola vía: su botón de envío, que abre el Hallandale Beach Self-Service Portal. La página de la Building Division dice que los documentos relacionados con permisos deben ir por su portal en línea, y que los enviados por correo electrónico a su dirección de soporte no se tramitan. Recibe visitas sin cita, aunque prefiere que se pida cita por teléfono. Antes de presentar nada, confirmamos con la Building Division de Hallandale Beach cómo quiere recibir su informe.',
      },
      {
        q: '¿Vendrá un inspector de la Ciudad de Hallandale Beach a inspeccionar nuestro edificio?',
        a: 'No, según las preguntas frecuentes de la ciudad: su revisión se basa totalmente en el informe, y las reparaciones se exigen tal como las indique el arquitecto o el ingeniero. Las mismas preguntas frecuentes dicen que el profesional que inspecciona decide, a su criterio, cuántas unidades se inspeccionan, y que la inspección atiende problemas estructurales y eléctricos que afectan la vida, la salud y la seguridad, no cambios estéticos.',
      },
      {
        q: '¿Qué hacemos si nuestro edificio en Hallandale Beach está en la lista del BSIP por error, o si no aparece en ella?',
        a: 'El modelo de notificación de la página del programa pide a quien crea que su edificio fue mal clasificado, y que entra en las exenciones, que lo comunique a la ciudad por escrito. Si un edificio no ha sido certificado, no figura en la lista o muestra señales de daños graves, las preguntas frecuentes piden avisar por la aplicación MyHB o por correo electrónico. Envíenos su carta de Hallandale Beach y la leemos junto con el historial del edificio.',
      },
      {
        q: '¿Qué tiene que ver el registro de condominios de Hallandale Beach con el BSIP?',
        a: 'La página del programa de Hallandale Beach remite a los propietarios a los documentos del registro de condominios de su edificio. La ciudad exige que las asociaciones de condominios, de propietarios de viviendas multifamiliares y de apartamentos en cooperativa se registren cada año. Ese registro pide el estado de la “recertificación” — así la llama allí la ciudad — y copia de todo informe de ingeniero o arquitecto, emitido en el año anterior, sobre las condiciones estructurales, eléctricas o de seguridad de las personas del edificio.',
      },
      {
        q: '¿El BSIP de Hallandale Beach es la misma inspección que llaman de 40 años?',
        a: 'Sí. Ese nombre antiguo sigue en varios documentos de Hallandale Beach: el aviso por correo electrónico enlazado desde la página del programa habla de una certificación de 40 años, y el modelo de notificación publicado allí es de un año anterior. Algunas páginas muestran también el calendario anterior, así que guíese por la carta que reciba. Las edades y los días vigentes en Hallandale Beach son los del condado, en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe la carta certificada del Building Official — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Confirmamos qué pide la Building Division de Hallandale Beach y para cuándo, y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
  {
    slug: 'deerfield-beach',
    program: 'broward-bsip',
    city: 'Deerfield Beach',
    place: 'Deerfield Beach',
    office: {
      name: 'City of Deerfield Beach Building Division',
      address: ['150 N.E. 2nd Ave.', 'Deerfield Beach, FL 33441'],
      phone: '(954) 250-4060',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Deerfield Beach: qué publica la ciudad, qué no dice y un equipo que lo entrega completo.',
    heroSub:
      'La Building Division de Deerfield Beach dice seguir las guías de la Board of Rules and Appeals; la ciudad publica los formularios. Un solo equipo entrega en ellos el BSIP completo: inspección e informe.',
    lede:
      'Deerfield Beach no tiene una página propia para el Programa de Inspección de Seguridad de Edificios (BSIP). En el sitio de la ciudad el programa aparece solo como cuatro documentos en la página Applications and Forms; cómo se tramitan los permisos, y quién los atiende, está en la página de Building Services. Lo que sigue recoge lo que dicen esas páginas y lo que dejan a la carta y a la Building Division.',
    local: [
      { k: 'Formularios de la ciudad', v: 'La página Applications and Forms de la ciudad incluye la política de la Board of Rules and Appeals (BORA) sobre el informe de inspección de seguridad, las guías de la inspección, un formulario estructural y uno eléctrico. El eléctrico lleva el encabezado de la propia BORA, “Broward County BORA”. Para un edificio de Deerfield Beach, el BSIP completo que entregamos, inspección e informe, va en esos formularios.' },
      { k: 'Presentación del informe', v: 'Las páginas propias de Deerfield Beach no dicen cómo se presenta un informe del BSIP. La página de Building Services describe el trámite de los permisos: las nuevas solicitudes y los planos pueden enviarse en línea, con el botón “Online Permit Submittal”, y todavía pueden llevarse en persona a la Building Division, en el City Hall (el ayuntamiento). Confirmamos con la división cómo recibe el informe antes de enviar nada.' },
      { k: 'La oficina', v: 'La Building Division dice que cumple con las guías de la Florida Building Commission y de la Broward County Board of Rules and Appeals. Su página dice también que CAP Government se encargará de todas las funciones relacionadas con el Florida Building Code, entre ellas las solicitudes de permiso, la aprobación de planos, las inspecciones y el cierre de los permisos; no dice quién revisa un informe del BSIP.' },
      { k: 'Reparaciones', v: 'Las páginas de la propia ciudad no dicen nada específico sobre las reparaciones del BSIP. Cuando una reparación necesita permiso, valen las reglas generales de permisos de Deerfield Beach: la página de formularios advierte que toda solicitud de permiso en la ciudad requiere la firma del propietario, y la página de Building Services dice que la DFB HOA Affidavit (una declaración jurada) se exige en todos los permisos residenciales.' },
      { k: 'Si se vence el plazo', v: 'Las páginas propias de Deerfield Beach no dicen qué hace la ciudad cuando un informe del BSIP llega tarde; el plazo para presentar está en los datos del condado, más abajo. La página de Building Services dice, en términos generales, que la división se ocupa de identificar y eliminar las estructuras inseguras junto con la Unsafe Structure Board (la junta de estructuras inseguras); no lo relaciona con este programa.' },
      { k: 'Lo que no dice', v: 'Las páginas de la propia ciudad no dicen quién envía la notificación en Deerfield Beach ni cuándo, qué ocurre tras presentar el informe ni cómo se pide una prórroga. La página de Building Services da el teléfono del Building Department para ayuda con solicitudes de permiso, requisitos o información para presentarlas; no nombra un contacto del BSIP. En Deerfield Beach, lo demás lo resuelven la carta y la Building Division.' },
    ],
    faq: [
      {
        q: '¿Dónde encontramos los formularios del BSIP para Deerfield Beach?',
        a: 'En la página Applications and Forms de la ciudad, que incluye un formulario estructural y otro eléctrico de la inspección de seguridad de edificios, junto con la política de la Board of Rules and Appeals y sus guías. El sitio no muestra ninguna hoja de portada, declaración jurada ni lista de verificación propia de la ciudad para el programa, así que confirmamos con la Building Division qué quiere recibir con el informe.',
      },
      {
        q: '¿Cómo presentamos el informe del BSIP en Deerfield Beach?',
        a: 'Las páginas propias de Deerfield Beach no lo dicen. Su portal en línea se titula Deerfield Beach Building Services Digital Permitting Portal, y la página de Building Services presenta el envío en línea y la visita a la Building Division, en el City Hall, para las solicitudes de permiso y los planos; no dice nada de los informes del BSIP. Preguntamos a la división cómo debe llegarle el informe antes de presentar el paquete.',
      },
      {
        q: '¿Qué pasa en Deerfield Beach si el informe del BSIP se entrega tarde?',
        a: 'Las páginas de la propia ciudad no lo dicen: publican como documento la política de la Board of Rules and Appeals, y la página de la Building Division habla en términos generales de las estructuras inseguras y de la Unsafe Structure Board, sin mencionar un informe entregado tarde. Si ya pasó la fecha de su carta de Deerfield Beach, envíela de todos modos: la leemos y confirmamos con la división qué pide ahora.',
      },
      {
        q: '¿Cuánto tiempo tenemos para presentar el informe del BSIP en Deerfield Beach?',
        a: 'El plazo para presentar en Deerfield Beach es el del condado y está en los datos de arriba. Las páginas de la propia ciudad no dan un plazo para el informe: lo que la ciudad publica es la política de la Board of Rules and Appeals, como documento en su página de formularios. Guíese por la fecha de la carta que recibió para su edificio de Deerfield Beach.',
      },
      {
        q: '¿El BSIP de Deerfield Beach es lo que todavía llamamos la recertificación de 40 años?',
        a: 'Es el programa que la reemplazó: la copia de la política de la Board of Rules and Appeals que tiene el sitio de la ciudad da “40 Year Building Safety Inspection Program” como nombre del programa anterior. Las páginas de la propia ciudad no usan ese nombre antiguo. Las edades y los días vigentes en Deerfield Beach son los del condado, en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe su carta de Deerfield Beach — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Confirmamos con la City of Deerfield Beach Building Division qué se pide y respondemos con una propuesta para el BSIP completo, inspección e informe.',
  },
  {
    slug: 'pembroke-pines',
    program: 'broward-bsip',
    city: 'Pembroke Pines',
    place: 'Pembroke Pines',
    office: {
      name: 'City of Pembroke Pines Building Department',
      address: ['601 City Center Way, 2nd Floor', 'Pembroke Pines, FL 33025'],
      phone: '(954) 435-6502',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Pembroke Pines: su número de permiso, cómo presentar y un equipo que lo entrega completo.',
    heroSub:
      'En Pembroke Pines los informes van al Building Department de la ciudad, en persona o por el Development Hub, y un solo equipo entrega completos la inspección y el informe del BSIP.',
    lede:
      'En Pembroke Pines el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por el Building Department (el departamento de construcción) de la ciudad. Al edificio que debe inspeccionarse se le asigna un número de permiso BSIP; la carta lo cita, y la página de la ciudad vuelve a pedirlo en la hoja de portada, para vincular la cuenta del Development Hub y al solicitar un permiso de reparación. Esto dicen las páginas de Pembroke Pines, paso a paso.',
    local: [
      { k: 'La notificación', v: 'Cuando a un edificio le corresponde la inspección, se asigna a la propiedad un número de permiso BSIP. El propietario que figura en el sitio web del Broward County Property Appraiser (el tasador de propiedades) recibe por correo una carta de notificación que cita ese número. Consérvela: Pembroke Pines pide el número en la hoja de portada, para vincular la cuenta en línea y al solicitar un permiso de reparación.' },
      { k: 'Presentación del informe', v: 'Cuando los informes de inspección están listos, se presentan ante el Building Department, y la página de la ciudad da dos opciones: en persona o en línea. La opción en línea pasa por el Development Hub, el portal donde hay que tener una cuenta. El Building Department está en el Charles F. Dodge City Center.' },
      { k: 'En persona', v: 'Para presentar en persona, la página enumera qué llevar: entre otras cosas, una hoja de portada — la llama Transmittal Letter — con el número de permiso BSIP, y los dos formularios del informe. Enlaza los formularios, pero ninguna hoja de portada. La página de formularios del departamento trae una “Transmittal Letter Sheet” con una línea para el número de permiso; el sitio nunca dice que sea la indicada para el BSIP.' },
      { k: 'El Development Hub', v: 'La página de Pembroke Pines detalla los pasos en línea. Con la cuenta del Development Hub ya creada, llame o escriba por correo electrónico al Building Department para que vinculen la cuenta al número de permiso BSIP. Una vez vinculada, inicie sesión y busque el permiso en el panel o con la herramienta de búsqueda. Ábralo y suba los documentos en la pestaña “Attachments” (adjuntos), cada uno por separado.' },
      { k: 'Formularios de la ciudad', v: 'La página del programa de Pembroke Pines enlaza dos formularios: el Structural Safety Inspection Report Form, para el informe estructural, y el Electrical Safety Inspection Report Form, para el informe eléctrico. Ambos archivos llevan la marca “Broward County BORA”; la página no enlaza ninguna edición con el nombre de la ciudad. Nombra los mismos dos formularios para presentar en persona y para hacerlo en línea.' },
      { k: 'Reparaciones', v: 'Si hacen falta reparaciones, la página de Pembroke Pines pide solicitar el permiso que corresponda: “Structural Miscellaneous” para las estructurales, “Electrical Miscellaneous” para las eléctricas. La solicitud es la edición vigente de la Broward County Uniform Building Permit Application y lleva el número de permiso BSIP, al que queda vinculado el permiso de reparación. Según la página de permisos, la ciudad ya no acepta solicitudes de permiso por correo electrónico.' },
      { k: 'Planos de las reparaciones', v: 'Para un permiso de reparación presentado en persona, la página dice que todos los planos deben ir firmados y sellados físicamente, y que en persona no se aceptan firmas digitales. En una presentación en línea, los planos de construcción llevan firma y sello digitales. En línea, todos los documentos requeridos deben subirse en el momento de presentar; no se puede subir nada más hasta que termine el ciclo de revisión.' },
      { k: 'Después de presentar', v: 'La página de Pembroke Pines dice que pueden requerirse inspecciones de seguimiento. Tras una reparación, con su permiso ya completado, se presenta al número de permiso BSIP un Safety Inspection Report Form actualizado; la página lo exige para dar por cumplido el programa. No dice quién revisa el informe, cómo se avisa al propietario ni cómo se pide más tiempo: los plazos del condado están en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Quién recibe la notificación del BSIP en Pembroke Pines?',
        a: 'El propietario que figura en el sitio web del Broward County Property Appraiser, por correo. La carta trata del Programa de Inspección de Seguridad de Edificios y cita el número de permiso BSIP asignado a la propiedad, que la página de la ciudad vuelve a pedir al presentar el informe. Envíenos esa carta — basta una foto tomada con el teléfono — y confirmamos qué pide el Building Department de Pembroke Pines y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe del BSIP en Pembroke Pines?',
        a: 'Ante el Building Department, por una de las dos vías que indica la página de la ciudad. En persona, con una hoja de portada que lleve el número de permiso BSIP. O en línea, con una cuenta del Development Hub que el departamento haya vinculado a ese número de permiso: los documentos se suben entonces en la pestaña “Attachments” del permiso, cada uno por separado.',
      },
      {
        q: '¿Pembroke Pines tiene sus propios formularios para el BSIP?',
        a: 'Para los informes, la página del programa no enlaza ninguno propio. Los dos formularios que sí enlaza — el Structural Safety Inspection Report Form y el Electrical Safety Inspection Report Form — llevan la marca “Broward County BORA”. Lo que la ciudad añade, al presentar en persona, es una hoja de portada que su página llama Transmittal Letter. Para un edificio de Pembroke Pines, la inspección y el informe completos del BSIP que entregamos van en los formularios que enlaza esa página.',
      },
      {
        q: '¿Qué necesita un condominio de Pembroke Pines para el permiso de reparación del BSIP?',
        a: 'El permiso de reparación se solicita como “Structural Miscellaneous” o “Electrical Miscellaneous”, con el número de permiso BSIP en la solicitud. La página de formularios del departamento, escrita para los permisos en general, añade dos documentos. Si el Property Appraiser registra el uso de la propiedad como condominio, hay que incluir una Condominium Approval Letter (carta de aprobación del condominio), firmada y notarizada por un agente registrado que figure en Sunbiz. Toda solicitud de permiso lleva la declaración jurada Homeowner’s Association Affidavit of Awareness.',
      },
      {
        q: '¿Qué pasa en Pembroke Pines si el informe del BSIP se entrega tarde?',
        a: 'La página del programa de Pembroke Pines no lo dice: no aparecen allí sanción, audiencia ni número de días; el plazo para presentar es el del condado, en los datos de arriba. Lo que sí dice es que los propietarios son responsables de completar las inspecciones a tiempo, y da un contacto por correo electrónico para pedir ayuda con el programa. Si cree que su edificio de Pembroke Pines ya está fuera de plazo, envíenos la carta igual.',
      },
    ],
    nextStep:
      'Envíe la carta con su número de permiso BSIP — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Leemos lo que pide el Building Department de Pembroke Pines y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
  {
    slug: 'miramar',
    program: 'broward-bsip',
    city: 'Miramar',
    place: 'Miramar',
    office: {
      name: 'City of Miramar Building, Planning & Zoning Department',
      address: ['2200 Civic Center Place', 'Miramar, FL 33025'],
      phone: '(954) 602-3200',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Miramar: el sistema de permisos, los formularios y un solo equipo que lo entrega completo.',
    heroSub:
      'La Building Division de Miramar emite el paquete del BSIP, y cada documento se presenta por el sistema municipal de permisos. Aquí, un solo equipo entrega completos la inspección y el informe.',
    lede:
      'El paquete de Miramar para el Programa de Inspección de Seguridad de Edificios (BSIP) lleva el membrete de la Building Division (la división de construcción) del City of Miramar Building, Planning & Zoning Department. La página del programa fija una sola vía de presentación, el sistema municipal de permisos, y dice que la revisión se basa solo en el informe sellado. Esto dicen las páginas de Miramar, tema por tema, y esto no aclaran.',
    local: [
      { k: 'La notificación', v: 'La página del programa de Miramar dice que los propietarios recibirán una Notificación de Inspección Requerida (Notice of Required Inspection); no dice quién la envía ni cómo. Si usted ya no es el propietario, indica que los registros del Broward County Property Appraiser (el tasador de propiedades del condado) se revisarán y se actualizarán si figura un nuevo propietario. Si todavía figura usted, debe comunicarse directamente con el tasador.' },
      { k: 'Presentación del informe', v: 'Todos los documentos del BSIP deben presentarse por el sistema de permisos de la Ciudad de Miramar, dice la página del programa, con el tipo de permiso BSIP: Residential BSIP o Commercial BSIP. No le da otro nombre; la página de permisos de la ciudad llama a su servicio en línea E-Permitting o Citizen Self Service (CSS Portal). Para pedir ayuda, la página del programa da un correo electrónico del BSIP.' },
      { k: 'Formularios de la ciudad', v: 'La página de solicitudes y formularios de Miramar publica el paquete del programa, con un título que empieza “Recertification / BSIP”. Su portada enumera lo adjunto: información del programa, guías de inspección y los formularios de los informes estructural y eléctrico. Son los de la Board of Rules and Appeals (la junta de reglas y apelaciones) del Condado de Broward; el paquete trae también la solicitud Broward County Uniform Building Permit Application.' },
      { k: 'Qué lo acompaña', v: 'La página del programa de Miramar enumera los documentos requeridos — un BSIP Submittal Form (formulario de presentación), el informe estructural, el informe eléctrico y documentación de respaldo, si corresponde — y dice que los informes deben ir firmados y sellados. Sus preguntas frecuentes presentan la lista de otro modo — una BSIP Submittal coversheet (hoja de portada), un Structural Packet y un Electrical Packet — y añaden que los formularios deben llevar firmas originales.' },
      { k: 'Después de presentar', v: 'Ningún inspector del código de construcción (Building Code Inspector) visita el edificio, dicen las preguntas frecuentes de Miramar: la revisión se basa únicamente en el informe sellado, y dan un tiempo aproximado para ella. A la pregunta de si el propietario recibe una certificación por escrito, responden que un expediente aceptado se cierra y no se emite ningún aviso; también piden incluir un correo electrónico para recibir una copia aprobada.' },
      { k: 'Reparaciones', v: 'Si se identifican deficiencias, la página de Miramar dice que debe entregarse una carta de estado (status letter) y, completadas las reparaciones, un informe final de certificación. Ningún inspector vuelve: según las preguntas frecuentes, debe presentarse un nuevo informe sellado. Su lista de lo que se presenta pide marcar “No Repairs Required” (no se requieren reparaciones); el plazo para reparar está en los datos de más abajo.' },
      { k: 'Permisos de reparación', v: 'Para un permiso de reparación, las preguntas frecuentes de Miramar piden la solicitud de un contratista con licencia y asegurado, con la documentación y la ubicación de las reparaciones; pueden requerirse cálculos estructurales. Si hace falta un permiso es una pregunta que remiten a su arquitecto, ingeniero o contratista. Añaden que el edificio no tiene que adecuarse del todo al código vigente, aunque las reparaciones pueden tener que ajustarse a él.' },
      { k: 'Si se vence el plazo', v: 'Las preguntas frecuentes de Miramar dicen que las prórrogas deben solicitarse por escrito. Sin prórroga, dicen, puede iniciarse un proceso de cumplimiento de códigos (code enforcement) y el edificio puede considerarse inseguro. La página del programa no nombra ningún órgano de audiencias; la portada del paquete del BSIP de la ciudad dice que el Building Official (el funcionario de construcción) hará cumplir el programa.' },
    ],
    faq: [
      {
        q: '¿Cómo presentamos el informe del BSIP en Miramar?',
        a: 'Por el sistema de permisos de la Ciudad de Miramar: la página del programa dice que todos los documentos del BSIP deben presentarse allí, como Residential BSIP o Commercial BSIP. El portal al que la ciudad enlaza para las solicitudes de permiso abre con “Welcome to the City of Miramar’s Development HUB”. La página del programa no enlaza ni su formulario de presentación ni su hoja de portada, así que confirmamos con la Building Division qué documento espera.',
      },
      {
        q: '¿Cómo sabemos si nuestro edificio de Miramar entra en el BSIP?',
        a: 'Para verificar si una propiedad está incluida, la página de Miramar remite a las listas de propiedades del BSIP del Condado de Broward. Sobre un edificio que aún no tiene la edad, sus preguntas frecuentes dicen que la Building Division la verificará con la oficina del Broward County Property Appraiser. Una demolición o remodelación interior no exime al edificio, dicen: solo cuenta la demolición total. Un edificio que se demolerá en unos meses necesita igualmente las inspecciones, añaden, sobre todo si sigue ocupado.',
      },
      {
        q: '¿Miramar envía un inspector a nuestro edificio para el BSIP?',
        a: 'No. Las preguntas frecuentes de Miramar dicen que ningún inspector del código de construcción visita el edificio: la revisión se basa únicamente en el informe sellado. Tampoco vuelve ninguno después de las reparaciones — debe presentarse un nuevo informe sellado. La ciudad dice además que no puede recomendar arquitectos ni ingenieros, por conflicto de intereses.',
      },
      {
        q: '¿Qué pasa en Miramar si el informe del BSIP se entrega tarde?',
        a: 'Las preguntas frecuentes de Miramar dicen que las prórrogas deben solicitarse por escrito y que, sin prórroga, puede iniciarse un proceso de cumplimiento de códigos y el edificio puede considerarse inseguro. No dicen quién recibe la solicitud ni cuánto dura una prórroga. Si ya pasó la fecha de la notificación de su edificio de Miramar, envíenosla de todos modos: confirmamos con la Building Division qué pide y para cuándo.',
      },
      {
        q: '¿El BSIP de Miramar es la misma recertificación de 40 años?',
        a: 'Sí. Los documentos de Miramar usan más de un nombre para el programa: en la página de formularios el título de su paquete empieza “Recertification / BSIP”, y la portada del paquete todavía habla de una “40-year inspection” (inspección de 40 años), el nombre anterior. Una de las preguntas frecuentes del programa da además un número de días distinto al del calendario de la misma página; las edades y los días vigentes son los del condado, en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe la notificación de su edificio de Miramar — basta una foto con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Leemos lo que pide la Building Division de Miramar y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
  {
    slug: 'plantation',
    program: 'broward-bsip',
    city: 'Plantation',
    place: 'Plantation',
    office: {
      name: 'City of Plantation Department of Building Safety',
      address: ['401 NW 70 Terrace', 'Plantation, FL 33317'],
      phone: '(954) 797-2765',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Plantation: carta certificada, presentación en línea y un equipo que lo entrega completo.',
    heroSub:
      'El Department of Building Safety de Plantation envía la carta certificada y recibe cada documento por vía electrónica. Un solo equipo entrega completos la inspección y el informe del BSIP en Plantation.',
    lede:
      'En Plantation el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por el Department of Building Safety (el departamento de seguridad de edificios). El departamento envía una carta certificada con el Record ID asignado y recibe cada documento por vía electrónica, mediante una cuenta en su portal Accela Citizen Access. Su página del programa es breve: esto es lo que dice, tema por tema, y lo que deja para la carta.',
    local: [
      { k: 'La notificación', v: 'El City of Plantation Department of Building Safety envía la carta por correo certificado. Puede ir dirigida al propietario, a la asociación, a la compañía administradora o a un representante debidamente autorizado. Trae el Record ID asignado — el número BDCERT — e indica qué pasos seguir. Consérvela: ese número se lo piden después, en los pasos para presentar los documentos.' },
      { k: 'Presentación del informe', v: 'Toda la documentación requerida del programa se presenta por vía electrónica, y la página de Plantation fija dos pasos, ambos obligatorios. Primero, cree una cuenta en línea en Accela Citizen Access (ACA). Después, reenvíe el correo que confirma el registro al contacto del programa que nombra la página, pida que conecten la cuenta al Recertification record (el registro de recertificación) correspondiente e incluya el número BDCERT.' },
      { k: 'La cuenta del portal', v: 'Accela Citizen Access gestiona los registros de la ciudad; su página de inicio se titula “Plantation E-Permit Online Portal”. La página del programa dice que hay que pedir la conexión de la cuenta para consultar y subir los documentos requeridos. La página municipal Electronic Plan Review, escrita para los permisos en el mismo portal, señala que no se admite enviar documentos desde dispositivos móviles y que se recomienda el navegador Chrome.' },
      { k: 'Formularios de la ciudad', v: 'La página del programa de Plantation no trae ningún formulario propio. Para los detalles completos y para obtener los formularios requeridos, remite a los propietarios al sitio web del Condado de Broward. Por eso el paquete de un edificio de Plantation va en los formularios que se obtienen allí.' },
      { k: 'Qué lo acompaña', v: 'Junto a los informes de inspección de seguridad (Safety Inspection Reports), la página nombra un documento más: el Narrative (la exposición escrita). Ambos deben llevar firma y sello digitales “para poder ser validados”, en palabras de la página. No enumera nada más para el paquete; para los detalles completos remite al sitio web del Condado de Broward, y la carta indica los pasos a seguir.' },
      { k: 'Firmas digitales', v: 'La página Electronic Plan Review de la ciudad, escrita para los permisos, dice que los documentos preparados por profesionales del diseño deben firmarse y sellarse con firma digital, que no se aceptan documentos autofirmados y que todos los archivos van en PDF. La Digital Signature Policy (la política de firma digital) municipal añade que modificar un documento ya firmado digitalmente invalida la firma. Ninguna de las dos menciona el BSIP.' },
      { k: 'Reparaciones', v: 'La página del programa de Plantation no habla de reparaciones ni les da un plazo; los plazos del condado están en los datos de más abajo. Las páginas de permisos de la ciudad dan la regla general: hace falta un permiso antes de reparar cualquier estructura de un edificio o parte de ella, y las solicitudes nuevas solo se aceptan en formato digital, por el mismo portal ACA.' },
      { k: 'Después de presentar', v: 'Aquí la página de Plantation guarda silencio. No dice quién revisa los informes, cómo se le avisa al propietario, cómo se pide una prórroga ni qué ocurre si el informe llega tarde. Para más información le da al programa un contacto propio — una dirección de correo electrónico y un número de teléfono distintos de la línea general de asistencia del departamento.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación del BSIP en Plantation?',
        a: 'El City of Plantation Department of Building Safety, por correo certificado. Según la página, la carta se envía cuando el programa llegue a afectar a su propiedad, e incluye el Record ID asignado. Envíenos esa carta — basta una foto tomada con el teléfono — y confirmamos qué pide el departamento de Plantation y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe del BSIP en Plantation?',
        a: 'Por vía electrónica, y solo después de dos pasos que la ciudad exige. Usted crea una cuenta en Accela Citizen Access, el portal de la ciudad, y reenvía el correo de registro al contacto del programa, pidiendo que conecten la cuenta al Recertification record correspondiente. La página dice que esto es necesario para consultar y subir los documentos. No menciona una alternativa en papel ni en persona: todo se presenta por vía electrónica.',
      },
      {
        q: '¿Plantation tiene sus propios formularios para el BSIP?',
        a: 'En su página del programa, no. Para los formularios requeridos y los detalles completos, la página remite a los propietarios al sitio web del Condado de Broward. Lo que sí indica la página de Plantation es cómo se presentan los documentos: el Narrative y los informes de inspección de seguridad deben llevar firma y sello digitales. Para un edificio de Plantation, la inspección y el informe completos del BSIP que entregamos van en esos formularios.',
      },
      {
        q: '¿Qué pasa en Plantation si el informe del BSIP se entrega tarde?',
        a: 'La página del programa de Plantation no lo dice. No menciona sanciones ni audiencias, y el plazo para presentar es el del condado, que está en los datos de arriba. La carta misma indica los pasos a seguir, y la página da un contacto del programa en el Department of Building Safety para más información. Si hace tiempo que tiene la carta de Plantation, envíenosla de todos modos.',
      },
      {
        q: '¿La recertificación de Plantation es lo mismo que el BSIP?',
        a: 'En la página de la propia ciudad son un mismo caso con dos nombres. Plantation presenta el Broward County Building Safety Inspection Program, y la misma página llama “Recertification record” al registro al que se conecta su cuenta, con un número BDCERT. La página dice que el programa lo establecieron las disposiciones del Condado de Broward en el código de construcción de Florida; las edades y los plazos vigentes están en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíe la carta certificada del Department of Building Safety de Plantation — basta una foto tomada con el teléfono — o, si aún no la tiene, la dirección y el año del certificado de ocupación. Leemos lo que pide el departamento y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
  {
    slug: 'sunrise',
    program: 'broward-bsip',
    city: 'Sunrise',
    place: 'Sunrise',
    office: {
      name: 'City of Sunrise Building Division',
      address: ['10770 W. Oakland Park Boulevard', 'Sunrise, FL 33351'],
      phone: '(954) 572-2354',
    },
    description:
      'BSIP en Sunrise: cómo recibe los informes la Building Division, en persona o por su Customer Self-Service Portal, y qué entrega un solo equipo.',
    heroSub:
      'La Building Division de Sunrise recibe los informes del BSIP, en persona o por su Customer Self-Service Portal; un solo equipo entrega completos la inspección y el informe.',
    lede:
      'En Sunrise el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por la Building Division, que recibe los informes. Cada año la Broward County Board of Rules and Appeals envía a la ciudad la lista de edificios por inspeccionar, y Sunrise publica una lista de verificación y una solicitud propias. Lo que sigue sale de esos documentos, de las páginas de la ciudad y de las agendas de su Special Magistrate (el magistrado especial).',
    local: [
      { k: 'La notificación', v: 'Según la ciudad, la lista de edificios por inspeccionar llega a Sunrise cada año desde la Broward County Board of Rules and Appeals y se basa en el año de construcción que consta en los registros del Property Appraiser del condado. Los casos de la agenda del Special Magistrate describen una notificación formal emitida por el Building Official (el funcionario de construcción), que fija el plazo.' },
      { k: 'Presentación del informe', v: 'Los informes se presentan ante la Building Division, en persona o de forma electrónica por el Customer Self-Service Portal de la ciudad, que pide crear primero una cuenta. La lista de verificación de Sunrise pide una solicitud por edificio y, en el portal, una presentación aparte para cada uno.' },
      { k: 'Papel o PDF', v: 'En persona, la lista de verificación de Sunrise pide un ejemplar original de cada informe, con sello y firma manuscrita. En el portal, cada elemento de la lista va en un archivo aparte, en PDF sin protección, y cada informe lleva firma y sello digitales; si los Plans Examiners (los revisores de planos) de la ciudad no pueden verificarlo digitalmente, el informe no se acepta.' },
      { k: 'Formularios de la ciudad', v: 'Sunrise tiene su propia solicitud para el programa y pide llenarla por completo, con el número de seguimiento (tracking number) de la notificación. Los informes van en los formularios vigentes del Building Safety Inspection Report, que según la ciudad se pueden descargar del sitio web del condado. Document Central, en el sitio de la ciudad, también tiene un formulario estructural y uno eléctrico del BSIP.' },
      { k: 'Qué lo acompaña', v: 'La solicitud de Sunrise enumera dos formularios de informe para el paquete: el estructural y el eléctrico. La lista de verificación pide llenar cada uno por completo y marcar en su portada si se requieren reparaciones: “No Repairs Required” o “Repairs are Required”. La solicitud tiene además una casilla Repairs Required Submittal, que pide los números de los permisos de las reparaciones.' },
      { k: 'Reparaciones', v: 'Cuando alguno de los informes se marca “Repairs Required”, los revisores de planos de Sunrise determinan si se requieren permisos, según las reparaciones que describe el informe. Una vez obtenidos los permisos y hechas las reparaciones, se presenta a la ciudad un nuevo informe marcado “No Repairs Required”. La ciudad dice que, cuando revisa y acepta ese informe, el edificio queda en cumplimiento del programa.' },
      { k: 'Si se vence el plazo', v: 'En Sunrise los casos por incumplimiento se ven ante un Special Magistrate, y la agenda de audiencias tiene un bloque del BSIP a nombre de la Building Division. Las propiedades de ese bloque figuran como fuera del plazo para cumplir con el programa. Las agendas citan también la exigencia de reparar las deficiencias encontradas y reinspeccionarlas en un plazo contado desde la fecha del informe.' },
      { k: 'Nombres antiguos', v: 'Algunos casos antiguos de reparaciones en una de las agendas del Special Magistrate todavía llaman “40 Year” (de 40 años) al formulario del informe, nombre del calendario anterior. El programa es el que Sunrise llama hoy Building Safety Inspection Program, y las edades y los días vigentes son los del condado, en los datos de más abajo.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación del BSIP en Sunrise?',
        a: 'El Building Official de Sunrise: la agenda del Special Magistrate describe una notificación formal emitida por el Building Official, que fija el plazo. La lista de edificios por inspeccionar llega a la ciudad cada año desde la Broward County Board of Rules and Appeals. Conserve la notificación: la solicitud de la ciudad pide su número de seguimiento, y Sunrise solo acepta el informe de un edificio al que ya se notificó que debe presentarlo.',
      },
      {
        q: '¿Cómo presentamos el informe del BSIP en Sunrise?',
        a: 'Ante la Building Division, en persona o de forma electrónica por el Customer Self-Service Portal, tras crear una cuenta. En los dos casos, cada edificio lleva su propia solicitud. La lista de verificación de Sunrise fija el formato: originales con sello y firma manuscrita en persona; en el portal, archivos PDF separados, sin protección, con cada informe firmado y sellado digitalmente. El paquete completo del BSIP que entregamos va en los formularios que pide Sunrise.',
      },
      {
        q: '¿Qué hacemos si nuestro edificio en Sunrise no debería estar en la lista del BSIP?',
        a: 'Las preguntas y respuestas de la ciudad dan un teléfono para llamar si usted cree que hubo un error. Explican que la lista se basa en el año de construcción según los registros del Property Appraiser del condado, y enumeran lo exento: viviendas unifamiliares y bifamiliares, edificios federales y del Estado de Florida, escuelas de la Broward County School Board, edificios por debajo de la superficie que indica la ciudad y edificios en reservas indígenas.',
      },
      {
        q: '¿Qué pasa en Sunrise cuando el informe del BSIP indica que se requieren reparaciones?',
        a: 'Los revisores de planos de la ciudad determinan si se requieren permisos, según las reparaciones que describe el informe. Una vez obtenidos los permisos y hechas las reparaciones, va a la ciudad un nuevo informe marcado “No Repairs Required”; la solicitud de Sunrise tiene una casilla Repairs Required Submittal que pide los números de los permisos. La ciudad dice que el edificio queda en cumplimiento cuando revisa y acepta ese informe.',
      },
      {
        q: '¿Qué pasa en Sunrise si el informe del BSIP se entrega tarde?',
        a: 'Los casos de informes atrasados figuran en la agenda del Special Magistrate de Sunrise, en un bloque del BSIP a nombre de la Building Division que describe las propiedades como fuera del plazo para cumplir. La misma agenda dice qué exige el programa al propietario: los formularios de certificación (Building Safety Inspection Certification Forms), presentados al Building Official. Sobre las audiencias, la ciudad remite al Clerk to the Special Magistrate (la secretaría del magistrado especial).',
      },
    ],
    nextStep:
      'Envíe la notificación del Building Official de Sunrise — basta una foto tomada con el teléfono — o, si aún no llega, la dirección y el año del certificado de ocupación. Confirmamos qué pide la Building Division y para cuándo, y respondemos con una propuesta para el BSIP completo, inspección e informe.',
  },
  {
    slug: 'davie',
    program: 'broward-bsip',
    city: 'Davie',
    place: 'Davie',
    office: {
      name: 'Town of Davie Building Division',
      address: ['8800 SW 36th Street, Building A', 'Davie, FL 33328'],
      phone: '(954) 797-1111',
    },
    description:
      'Programa de Inspección de Seguridad de Edificios (BSIP) en Davie: la notificación, OAS y Project Dox, y qué entrega, completo, un solo equipo.',
    heroSub:
      'La Building Division de Davie envía las notificaciones del BSIP y ya no acepta informes en papel. Un solo equipo entrega completos la inspección y el informe del BSIP de su edificio.',
    lede:
      'En Davie el Programa de Inspección de Seguridad de Edificios (BSIP) pasa por la Building Division (la división de construcción). El Building Official (el funcionario de construcción) envía la notificación por correo certificado y ya no se aceptan copias en papel: la solicitud entra por OAS y los informes se suben después a Project Dox. Esto dicen las páginas del municipio, tema por tema; los plazos del condado, más abajo.',
    local: [
      { k: 'La notificación', v: 'El Building Official envía cada año, por correo certificado, la notificación (Notice of Required Building Safety Inspection) al propietario registrado y a la asociación que administra cada propiedad que debe inspeccionarse ese año. El formulario de solicitud del municipio dice que el número de caso está en esa notificación y que la solicitud no se acepta sin él, así que tenga la carta a mano.' },
      { k: 'Presentación del informe', v: 'Davie ya no acepta copias en papel, dice su página: todo informe debe presentarse firmado y sellado digitalmente. El trámite empieza con la solicitud del municipio, que se envía por OAS (Online Application Submittal), el sistema que la página de la Building Division describe como el método obligatorio para los permisos y sus demás solicitudes de servicio. Los informes se suben después, en Project Dox.' },
      { k: 'La carga en Project Dox', v: 'La carga no es lo primero. El personal revisa la solicitud y, más adelante en los pasos del municipio, un correo electrónico le pide crear una cuenta en Project Dox y subir los documentos. Cada documento se sube por separado: la solicitud en la carpeta “Permit application”, el informe eléctrico y el informe estructural cada uno solo en su carpeta, y lo demás en “Documents”.' },
      { k: 'Formularios del municipio', v: 'La página del programa de Davie enumera los formularios que deben completarse al presentar: la solicitud propia del municipio (Building Safety Inspection Application Form) y los formularios de inspección de seguridad, el estructural y el eléctrico. Dice que el informe debe ir en el formulario de informe que designa la Broward County Board of Rules and Appeals (la junta de reglas y apelaciones del condado).' },
      { k: 'Qué lo acompaña', v: 'Davie pide que cada informe llegue con fotos a color y una carta firmada y sellada que indique el estado actual de la propiedad — con reparaciones o sin ellas — y si es seguro ocuparla. La carpeta “Documents” recibe la Electronic Signature Affidavit (declaración jurada de firma electrónica), que la página ofrece entre sus recursos, con las fotos, la carta de presentación, croquis y planos.' },
      { k: 'Después de presentar', v: 'El municipio revisa los informes; la página del programa no dice cómo se entera el propietario del resultado ni cómo se tramita una corrección. Para problemas con la carga remite a la línea telefónica de la Building Division, y la página de contacto (Contact Us) de la división incluye un puesto de examinador de permisos cuyo título menciona el BSIP.' },
      { k: 'Reparaciones', v: 'La página de Davie exige un permiso de construcción para toda reparación que se derive del informe del BSIP. Cuando hacen falta reparaciones pide además una carta firmada y sellada, entregada al propietario y al Building Official, sobre si el edificio puede seguir ocupado con seguridad mientras tanto. Esa carta vale por un tiempo limitado, y se emite una nueva si los trabajos continúan.' },
      { k: 'Quién está exento', v: 'La página de Davie enumera entre los exentos los edificios federales y los del Estado de Florida, los de tierras tribales soberanas y, dentro de los límites que detalla, las casas, las viviendas multifamiliares pequeñas y las llamadas estructuras menores. Si cree que su edificio debería estar en la lista de inspección del condado, la página remite a la Broward County Building Code Services Division.' },
    ],
    faq: [
      {
        q: '¿Quién nos envía la notificación del BSIP en Davie y cómo llega?',
        a: 'La envía el Building Official de Davie, por correo certificado, al propietario registrado y a la asociación que administra la propiedad. La página del municipio indica los meses de cada año en que salen las notificaciones. La carta trae el número de caso que pide la solicitud del municipio, así que basta con enviarnos una foto tomada con el teléfono: la leemos y confirmamos qué pide la Building Division y para cuándo.',
      },
      {
        q: '¿Cómo presentamos el informe del BSIP en Davie?',
        a: 'No en papel: la página del municipio dice que ya no acepta copias impresas. La solicitud entra por OAS, su sistema Online Application Submittal. Cuando el personal la ha revisado, y más adelante en el trámite, un correo electrónico lo invita a crear una cuenta en Project Dox y subir los informes y sus anexos, cada documento por separado, en la carpeta que le asigna la página. Los informes deben ir firmados y sellados digitalmente.',
      },
      {
        q: '¿Necesitamos permiso para las reparaciones del BSIP en Davie?',
        a: 'Sí. La página del programa dice que se requiere un permiso de construcción para todas las reparaciones relacionadas con el informe del BSIP, y la de la Building Division dice que los permisos de construcción se solicitan por OAS. Terminadas las reparaciones, la primera pide una nueva inspección de las áreas señaladas en el informe original y un informe enmendado, con una carta firmada y sellada que declare completadas las reparaciones y correcciones requeridas.',
      },
      {
        q: '¿Qué pasa en Davie si el informe del BSIP se entrega tarde, y podemos pedir más tiempo?',
        a: 'La página del programa de Davie no responde ninguna de las dos preguntas. Cuenta el plazo para presentar desde la fecha de la notificación, pero no describe ninguna forma de pedir más tiempo ni dice nada sobre un informe entregado tarde. El plazo es el del condado, en los datos de arriba. Si su fecha está cerca o ya pasó, envíenos la notificación ahora, para confirmar con la Building Division qué pide y para cuándo.',
      },
      {
        q: '¿El BSIP de Davie es la misma inspección de 40 años?',
        a: 'Sí. Un boletín del municipio que anunciaba las notificaciones de la Building Division describió el BSIP como el nuevo nombre del programa que antes se conocía como la inspección de 40 años. La página del programa todavía enlaza unas preguntas frecuentes con el nombre de 40 años en el título. Es un solo programa, y las edades vigentes hoy están en los datos de arriba.',
      },
    ],
    nextStep:
      'Envíenos la notificación de la Town of Davie Building Division — basta una foto tomada con el teléfono — o, si aún no llega, la dirección y el año del certificado de ocupación. Leemos lo que pide Davie y respondemos con una propuesta para la inspección y el informe completos del BSIP.',
  },
];
