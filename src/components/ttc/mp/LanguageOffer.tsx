'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { refreshSearch, useContent, useLang } from './lang';

/**
 * "¿Prefiere leer esto en español?" — one line on ENGLISH pages, for a
 * visitor whose browser is set to Spanish.
 *
 * The county's letter is in English and so is most of what people search
 * for, so a Spanish-speaking owner usually lands on the English page, and
 * the only sign that the whole site exists in Spanish was two letters in the
 * header. This says it in a sentence, in Spanish, with a link to the same
 * page under /es (`href` comes from the header: the twin path, query string
 * included).
 *
 * What it must never do:
 *   • Redirect. The visitor chose this URL, and a shared or searched link
 *     has to open in the language it was written in (i18n.ts). It offers;
 *     the visitor decides.
 *   • Move the page, or show at all to anyone else. It is not in the server
 *     HTML: the server and the hydration pass render nothing, and the
 *     browser's language is read after that. On screen it is out of the
 *     flow (mp.css: under the header, at the top of the page, scrolling
 *     away with it), so no layout shifts when it appears either.
 *   • Come back once it has had its answer — closed, or the visitor has
 *     been on a Spanish page, which means they found it. That is remembered
 *     for the session only: sessionStorage, this tab, gone when it closes.
 *     No cookie, and the language itself is never stored — the URL is still
 *     the only state.
 *
 * English is not offered on Spanish pages the same way: whoever is on /es
 * followed a Spanish link or used the switch, and asking them again would be
 * nagging.
 */

const STORAGE_KEY = 'ttc-es-offer';

const listeners = new Set<() => void>();

/** The same fact as the stored flag, for a browser that blocks storage. */
let answeredHere = false;

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function answered(): boolean {
  if (answeredHere) return true;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Private mode, or site data blocked: reading throws.
    return false;
  }
}

/** The offer has had its answer: closed, or a Spanish page was opened. */
function settle() {
  if (answered()) return;
  answeredHere = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Not stored: `answeredHere` still holds until the page is reloaded.
  }
  listeners.forEach((notify) => notify());
}

// "es", "es-US", "es-419"… The FIRST language of the browser only: a visitor
// who lists English first and Spanish second has already chosen.
const prefersSpanish = () =>
  /^es(?:-|$)/i.test(window.navigator.language) && !answered();
const notOnServer = () => false;

export function LanguageOffer({ href }: { href: string }) {
  const lang = useLang();
  const offer = useContent().ui.language.offer;
  const wanted = useSyncExternalStore(subscribe, prefersSpanish, notOnServer);

  useEffect(() => {
    if (lang === 'es') settle();
  }, [lang]);

  if (lang !== 'en' || !wanted) return null;

  return (
    // Spanish inside an English page, so it says so itself.
    <div className="mp-langoffer" lang="es">
      <Link
        href={href}
        hrefLang="es"
        // Same reason as the header's switch: see refreshSearch.
        onPointerDown={refreshSearch}
        onFocus={refreshSearch}
      >
        {offer.text}
      </Link>
      {/* The mark is drawn in CSS; the name is the label. */}
      <button type="button" aria-label={offer.dismiss} onClick={settle} />
    </div>
  );
}
