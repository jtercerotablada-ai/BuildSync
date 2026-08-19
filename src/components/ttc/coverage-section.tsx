'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from './language-provider';

/**
 * Service Area — the South-Florida municipalities the firm designs and permits
 * in, rendered as numbered editorial grids per county. Also a strong
 * local-SEO signal.
 *
 * Miami-Dade: the county's municipalities ("Islandia" omitted — dissolved
 * 2012). Broward: the county's 31 municipalities + unincorporated.
 */

const MIAMI_DADE = [
  'Miami', 'Miami Beach', 'Coral Gables', 'Hialeah', 'Miami Springs',
  'North Miami', 'North Miami Beach', 'Opa-locka', 'South Miami', 'Homestead',
  'Miami Shores', 'Bal Harbour', 'Bay Harbor Islands', 'Surfside', 'West Miami',
  'Florida City', 'Biscayne Park', 'El Portal', 'Golden Beach', 'Pinecrest',
  'Indian Creek', 'Medley', 'North Bay Village', 'Key Biscayne', 'Sweetwater',
  'Virginia Gardens', 'Hialeah Gardens', 'Aventura', 'Unincorporated Miami-Dade County',
  'Sunny Isles Beach', 'Miami Lakes', 'Palmetto Bay', 'Miami Gardens', 'Doral', 'Cutler Bay',
];

const BROWARD = [
  'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Miramar', 'Coral Springs',
  'Pompano Beach', 'Davie', 'Sunrise', 'Plantation', 'Deerfield Beach',
  'Lauderhill', 'Weston', 'Tamarac', 'Margate', 'Coconut Creek',
  'Oakland Park', 'North Lauderdale', 'Hallandale Beach', 'Dania Beach', 'Cooper City',
  'Parkland', 'Lauderdale Lakes', 'Wilton Manors', 'West Park', 'Southwest Ranches',
  'Pembroke Park', 'Lauderdale-by-the-Sea', 'Lighthouse Point', 'Hillsboro Beach',
  'Sea Ranch Lakes', 'Lazy Lake', 'Unincorporated Broward County',
];

function CountyGroup({ name, note, items }: { name: string; note: string; items: string[] }) {
  return (
    <div className="coverage__county">
      <div className="coverage__county-head">
        <h3 className="coverage__county-name">{name}</h3>
        <span className="coverage__county-note">{note}</span>
      </div>
      <ol className="coverage__grid">
        {items.map((m, i) => (
          <li key={m} className="coverage__item">
            <span className="coverage__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="coverage__name">{m}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CoverageSection() {
  const { language } = useTranslation();
  const es = language === 'es';
  const reduce = useReducedMotion();

  const label = es ? 'Área de Servicio' : 'Service Area';
  const title = es ? (
    <>Cobertura en <em>todo</em> el sur de Florida.</>
  ) : (
    <>Coverage across <em>all</em> of South Florida.</>
  );
  const sub = es
    ? 'Diseñamos y tramitamos permisos de estructuras de concreto armado en cada ciudad de Miami-Dade y Broward.'
    : 'We design and permit reinforced-concrete structures in every city of Miami-Dade and Broward.';

  return (
    <section className="coverage" aria-label={label}>
      <div className="container">
        <motion.div
          className="coverage__head"
          initial={reduce ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -60px 0px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="section__label">{label}</span>
          <h2 className="section__title">{title}</h2>
          <p className="coverage__sub">{sub}</p>
        </motion.div>

        <motion.div
          className="coverage__counties"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '0px 0px -60px 0px' }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <CountyGroup
            name={es ? 'Condado de Miami-Dade' : 'Miami-Dade County'}
            note={`${MIAMI_DADE.length} ${es ? 'municipios' : 'municipalities'}`}
            items={MIAMI_DADE}
          />
          <CountyGroup
            name={es ? 'Condado de Broward' : 'Broward County'}
            note={`${BROWARD.length} ${es ? 'municipios' : 'municipalities'}`}
            items={BROWARD}
          />
        </motion.div>
      </div>
    </section>
  );
}
