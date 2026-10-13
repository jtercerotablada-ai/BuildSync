"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

/* The error screen of the PUBLIC site: what a visitor gets when a public
   page throws while it draws. The two public route groups used to mount the
   staff application's screen here — its look, English on the Spanish pages,
   and a way out ("Back to home", /home) that on this host ends at the staff
   sign-in. This one is the site's: its colours and type, the visitor's
   language, and the public home page as the way out.

   It replaces the whole page, header and footer included: the boundary sits
   beside the root layout, above the chrome in (site)/layout.tsx. So nothing
   of the site is guaranteed to be around it, and it brings its own few rules,
   scoped by class and inlined with the markup, as the application's
   FallbackScreen does. The values are mp.css's (graphite, paper, snow, gold;
   the page hero's sizes; the button), written out because the tokens live on
   `.mp`, which went with the chrome. The type is the site's whenever its
   stylesheet is in the document — a page that broke after it loaded keeps it
   — and the system's otherwise.

   The words are here and not in site.ts: every public page carries this
   file, and it is what is left standing when something of the site's has
   failed — so it imports nothing of the site's, its copy included. Nothing
   of the error is shown and nothing is sent: the console keeps it. */

const FIRM = "Tercero Tablada Civil and Structural Engineering Inc.";

const WORDS = {
  en: {
    label: "Error",
    title: "This page could not be shown.",
    text: "Try again. If it happens again, go to the home page and open it from there.",
    again: "Try again",
    home: "Home",
    href: "/",
  },
  es: {
    label: "Error",
    title: "Esta página no se pudo mostrar.",
    text: "Inténtelo de nuevo. Si vuelve a ocurrir, vaya a la página de inicio y ábrala desde allí.",
    again: "Intentar de nuevo",
    home: "Inicio",
    href: "/es",
  },
} as const;

const css = `
body{margin:0}
html:has(.ttc-pe){background:#f6f4ef}
.ttc-pe{box-sizing:border-box;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;background:#f6f4ef;color:#0b0c0d;font-family:Geist,'Geist Fallback',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:1rem;line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-text-size-adjust:100%}
.ttc-pe *,.ttc-pe *::before,.ttc-pe *::after{box-sizing:border-box}
.ttc-pe__band{padding-bottom:4rem;background-color:#0b0c0d;background-image:linear-gradient(to right,rgba(246,244,239,.045) 1px,transparent 1px),linear-gradient(to bottom,rgba(246,244,239,.045) 1px,transparent 1px);background-size:72px 72px;background-position:center top;color:#f6f4ef}
.ttc-pe__shell{width:100%;max-width:1400px;margin-inline:auto;padding-inline:clamp(1.25rem,4.5vw,4.5rem)}
.ttc-pe__mark{display:inline-flex;align-items:center;min-width:44px;height:76px}
.ttc-pe__mark img{display:block;width:auto;height:clamp(36px,4vw,44px);margin-inline-start:calc(clamp(36px,4vw,44px) * -.133)}
.ttc-pe__copy{max-width:min(100%,62ch);margin-top:4rem}
.ttc-pe__copy>*{margin:0}
.ttc-pe__label{display:flex;align-items:center;gap:.75rem;font-size:.75rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#a8a9a5}
.ttc-pe__label::before{content:'';flex:none;width:20px;height:1px;background:#c99a38}
.ttc-pe__title{margin-top:1.5rem;font-size:clamp(2.4rem,5vw,4.25rem);line-height:.98;font-weight:500;letter-spacing:-.03em;text-wrap:balance}
.ttc-pe__text{margin-top:1.5rem;font-size:clamp(1.1rem,1.3vw,1.3rem);color:#a8a9a5;text-wrap:pretty}
.ttc-pe__actions{display:flex;flex-wrap:wrap;gap:.75rem;padding-block:clamp(4rem,7vw,6.5rem)}
.ttc-pe__btn{display:inline-flex;align-items:center;justify-content:center;gap:.7rem;min-height:50px;margin:0;padding:.95rem 1.6rem;border:1px solid #0b0c0d;border-radius:0;background:#0b0c0d;color:#f6f4ef;font:inherit;font-size:.9375rem;font-weight:500;line-height:1;text-decoration:none;white-space:nowrap;cursor:pointer}
.ttc-pe__btn--line{border-color:rgba(11,12,13,.28);background:transparent;color:#0b0c0d}
.ttc-pe a:focus-visible,.ttc-pe button:focus-visible{outline:2px solid #7a5d1c;outline-offset:3px}
.ttc-pe__band a:focus-visible{outline-color:#c99a38}
@media (hover:hover) and (pointer:fine){.ttc-pe__btn:hover{box-shadow:inset 0 -2px 0 #c99a38}.ttc-pe__btn--line:hover{border-color:#0b0c0d}}
@media (max-width:1180px){.ttc-pe__mark{height:68px}}
@media (max-width:640px){.ttc-pe__btn{width:100%;white-space:normal;text-align:center;line-height:1.25}}
`;

export function PublicError({
  lang,
  error,
  reset,
}: {
  lang: keyof typeof WORDS;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const w = WORDS[lang];

  useEffect(() => {
    console.error(error);
  }, [error]);

  /* As the application's screen does it: reset() alone clears the boundary
     and draws the SAME payload again, so a page that failed on the server
     came straight back. Fetch it again first, in one transition with the
     reset, so that "Try again" does try again. */
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <main className="ttc-pe" lang={lang}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="ttc-pe__band">
        <div className="ttc-pe__shell">
          {/* The header's own white mark, where the header had it. The link is
              named as the header names it; the picture's alt is the firm. */}
          <a href={w.href} className="ttc-pe__mark" aria-label={`${FIRM} — ${w.home}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ttc/img/logo-white@144.webp" alt={FIRM} width={144} height={144} />
          </a>
          {/* It takes the place of a page somebody was reading or filling in:
              said aloud once, to whoever cannot see that the page went. */}
          <div className="ttc-pe__copy" role="alert">
            <p className="ttc-pe__label">{w.label}</p>
            <h1 className="ttc-pe__title">{w.title}</h1>
            <p className="ttc-pe__text">{w.text}</p>
          </div>
        </div>
      </div>
      <div className="ttc-pe__shell ttc-pe__actions">
        <button type="button" onClick={retry} className="ttc-pe__btn">
          <span>{w.again}</span>
          <span aria-hidden="true">→</span>
        </button>
        {/* A plain link, not next/link: the way out of a page that broke is a
            new document, with nothing of the old one left running. A client
            hop to the address the visitor is already on (the home page
            itself) would change nothing, and leave this screen up. */}
        <a href={w.href} className="ttc-pe__btn ttc-pe__btn--line">
          <span>{w.home}</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </main>
  );
}
