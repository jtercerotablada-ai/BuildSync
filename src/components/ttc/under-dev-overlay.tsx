'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslation } from './language-provider';

export function UnderDevOverlay() {
  const pathname = usePathname();
  const { language } = useTranslation();

  const isResources = pathname?.startsWith('/resources');
  const active = !isResources;

  useEffect(() => {
    if (active) {
      document.body.classList.add('under-dev');
    } else {
      document.body.classList.remove('under-dev');
    }
    return () => document.body.classList.remove('under-dev');
  }, [active]);

  if (!active) return null;

  const t = {
    badge: language === 'es' ? 'En Desarrollo' : 'Under Development',
    titleA: language === 'es' ? 'Algo' : 'Something',
    titleB: language === 'es' ? 'grande' : 'great',
    titleC: language === 'es' ? 'esta por llegar.' : 'is coming.',
    desc:
      language === 'es'
        ? 'Estamos puliendo esta seccion. Mientras tanto, explora nuestras herramientas de ingenieria gratuitas — completas, validadas y listas para usar.'
        : 'We\u2019re polishing this section. Meanwhile, explore our free engineering tools — fully built, validated, and ready to use.',
    cta1: language === 'es' ? 'Abrir Calculadoras' : 'Open Calculators',
    cta2: language === 'es' ? 'Contactenos' : 'Contact Us',
    footer:
      language === 'es'
        ? 'Tercero Tablada · Ingenieria Civil y Estructural'
        : 'Tercero Tablada · Civil & Structural Engineering',
  };

  return (
    <div className="under-dev-overlay" role="dialog" aria-labelledby="udTitle" aria-describedby="udDesc">
      <div className="under-dev-card">
        <div className="under-dev-badge">
          <span className="dot" />
          <span>{t.badge}</span>
        </div>
        <div className="under-dev-logo">
          <span className="t1">T</span>
          <span className="t2">T</span>
        </div>
        <h1 id="udTitle" className="under-dev-title">
          {t.titleA} <span className="accent">{t.titleB}</span> {t.titleC}
        </h1>
        <p id="udDesc" className="under-dev-desc">
          {t.desc}
        </p>
        <div className="under-dev-actions">
          <a href="/resources" className="under-dev-btn under-dev-btn--primary">
            <span>{t.cta1}</span>
            <span aria-hidden>→</span>
          </a>
          <a href="/resources/quick-design" className="under-dev-btn under-dev-btn--outline">
            {language === 'es' ? 'Ver 101 Calculadoras' : 'Browse 101 Tools'}
          </a>
        </div>
        <div className="under-dev-footer">{t.footer}</div>
      </div>
    </div>
  );
}
