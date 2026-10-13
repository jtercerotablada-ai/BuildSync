import { createElement as h, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffError from "@/app/(app)/error";
import EnglishError from "@/app/(public)/error";
import SpanishError from "@/app/(public-es)/error";
import { getContent } from "@/lib/ttc/content";
import { PublicError } from "./public-error";

/**
 * THE PUBLIC SITE'S ERROR SCREEN — what a visitor gets when a public page
 * throws while it draws.
 *
 * The two public route groups used to re-export the staff application's
 * screen. A review reached it from a calculator (its arithmetic made to
 * throw): the public page was replaced by "This screen failed to load", in
 * English on the Spanish page, with "Back to home" leading to /home — the
 * staff sign-in. Nothing in a build or in a page test shows that, because an
 * error boundary draws nothing until something throws. So both screens are
 * drawn here, and read the way the visitor would read them.
 */

// Outside Next there is no router. The screen asks it for one thing.
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const ROOT = resolve(__dirname, "..", "..", "..");
const source = (...path: string[]) => readFileSync(join(ROOT, ...path), "utf8");

/** An error with everything a visitor must never be shown. */
const fault = () => Object.assign(new Error("SECRET-CAUSE at analysis.ts:4711"), { digest: "DIGEST-4711" });

const SCREENS = [
  { lang: "en", Screen: EnglishError, file: ["src", "app", "(public)", "error.tsx"], home: "/" },
  { lang: "es", Screen: SpanishError, file: ["src", "app", "(public-es)", "error.tsx"], home: "/es" },
] as const;

const WORDS = {
  en: {
    title: "This page could not be shown.",
    text: "Try again. If it happens again, go to the home page and open it from there.",
    again: "Try again",
  },
  es: {
    title: "Esta página no se pudo mostrar.",
    text: "Inténtelo de nuevo. Si vuelve a ocurrir, vaya a la página de inicio y ábrala desde allí.",
    again: "Intentar de nuevo",
  },
} as const;

const draw = (Screen: (typeof SCREENS)[number]["Screen"]) => renderToStaticMarkup(h(Screen, { error: fault(), reset: () => {} }));
/** The markup without the rules it carries. */
const body = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, "");
/** The rules it carries. */
const rules = (html: string) => html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
/** What is read on the screen, piece by piece. */
const pieces = (html: string) => [...body(html).matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** Every element of a tree of React elements, in order. */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

beforeEach(() => {
  router.refresh.mockClear();
});

describe("public error screen: what the visitor reads", () => {
  for (const { lang, Screen, home } of SCREENS) {
    const html = draw(Screen);
    const w = WORDS[lang];

    it(`${lang}: one screen, in the page's language, that says what happened in one sentence`, () => {
      expect(html.match(/<main\b[^>]*>/g)).toEqual([`<main class="ttc-pe" lang="${lang}">`]);
      expect(html.match(/<h1\b[^>]*>([^<]*)<\/h1>/g)).toHaveLength(1);
      expect(html).toMatch(new RegExp(`<h1\\b[^>]*>${w.title}</h1>`));
      expect(pieces(html)).toEqual(["Error", w.title, w.text, w.again, "→", getContent(lang).ui.notFound.home, "→"]);
      // The page was replaced under the visitor: what happened is announced, once — the words and nothing else.
      expect(body(html).match(/role="alert"/g)).toHaveLength(1);
      expect(body(html)).toContain('<div class="ttc-pe__copy" role="alert">');
    });

    it(`${lang}: the two actions — "${w.again}" is a button, and the way out is the home page of that language`, () => {
      const buttons = [...body(html).matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
      expect(buttons).toHaveLength(1);
      expect(attr(buttons[0], "type")).toBe("button");
      expect(buttons[0]).toContain(`<span>${w.again}</span>`);
      // Every link on it: the firm's mark and the button beside "Try again".
      const links = [...body(html).matchAll(/<a\b[^>]*>/g)].map((m) => attr(m[0], "href"));
      expect(links).toEqual([home, home]);
      // The button is the home page under the word the site's own 404 gives it.
      expect(body(html)).toMatch(new RegExp(`<a href="${home}" class="ttc-pe__btn ttc-pe__btn--line"><span>${getContent(lang).ui.notFound.home}</span>`));
    });

    it(`${lang}: nothing of the error is shown — no message, no reference, no stack`, () => {
      expect(html).not.toContain("SECRET-CAUSE");
      expect(html).not.toContain("analysis.ts");
      expect(html).not.toContain("DIGEST-4711");
      expect(body(html)).not.toMatch(/reference|referencia|stack|digest/i);
    });

    it(`${lang}: the firm's real mark, named as the header names it`, () => {
      const c = getContent(lang);
      const img = [...body(html).matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      expect(img).toHaveLength(1);
      // The header's own file (site.ts, `logo.markLightXs`), on disk.
      expect(attr(img[0], "src")).toBe(c.company.logo.markLightXs);
      expect(existsSync(join(ROOT, "public", attr(img[0], "src")!))).toBe(true);
      expect(attr(img[0], "alt")).toBe(c.company.name);
      expect(body(html)).toContain(`aria-label="${c.company.name} — ${c.ui.home}"`);
    });

    it(`${lang}: nothing on it but the page's own words — no date, no price, no name of a product`, () => {
      const text = pieces(html).join(" ");
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/free|gratis|price|precio|next\.?js|vercel|react/i);
    });
  }

  it("es: formal address throughout", () => {
    const text = pieces(draw(SpanishError)).join(" ");
    expect(text).toMatch(/Inténtelo/);
    expect(text).toMatch(/\bvaya\b/);
    expect(text).toMatch(/ábrala/);
    expect(text).not.toMatch(/inténtalo|\bintenta\b|\bve a\b|\bvuelve a la\b|ábrela|\btú\b|\btu\b/i);
  });

  it("the two screens are one screen in two languages", () => {
    const skeleton = (html: string) =>
      body(html)
        .replace(/>[^<>]+</g, "><")
        .replace(/\s(?:lang|href|aria-label|alt)="[^"]*"/g, "");
    expect(skeleton(draw(SpanishError))).toBe(skeleton(draw(EnglishError)));
    expect(rules(draw(SpanishError))).toBe(rules(draw(EnglishError)));
  });
});

describe("public error screen: it is not the staff application's", () => {
  const staff = renderToStaticMarkup(h(StaffError, { error: fault(), reset: () => {} }));

  it("the staff screen is still what it was: its own look, its reference, and /home", () => {
    expect(staff).toContain('class="ttc-fb"');
    expect(pieces(staff)).toEqual([
      "Something went wrong",
      "This screen failed to load. Try again — if it keeps happening, go back home and reopen it from there.",
      "Reference: DIGEST-4711",
      "Try again",
      "Back to home",
    ]);
    expect([...staff.matchAll(/<a\b[^>]*>/g)].map((m) => attr(m[0], "href"))).toEqual(["/home"]);
  });

  for (const { lang, Screen } of SCREENS) {
    it(`${lang}: none of the staff screen's words, its look or its links`, () => {
      const html = draw(Screen);
      // "Try again" is the one thing the two have in common, and only in English.
      for (const words of pieces(staff).filter((p) => p !== "Try again")) expect(body(html)).not.toContain(words);
      expect(body(html)).not.toMatch(/failed to load|this screen|back to home|\bapp\b|sign in|log ?in/i);
      expect(html).not.toContain("ttc-fb");
      expect(html).not.toMatch(/href="\/(?:home|login|portal|dashboard)\b/);
      expect(html).not.toMatch(/href="https?:/);
    });
  }

  for (const { lang, file } of SCREENS) {
    it(`${lang}: the route group mounts the public screen, in its language, and nothing of the application`, () => {
      const code = source(...file);
      expect(code).toMatch(/^"use client";/);
      expect(code).toContain('import { PublicError } from "@/components/layout/public-error";');
      expect(code).toContain(`<PublicError lang="${lang}" {...props} />`);
      expect(code).not.toMatch(/from\s+"@\/app\/\(app\)|fallback-screen/);
    });
  }
});

describe("public error screen: what it does", () => {
  for (const { lang, Screen } of SCREENS) {
    it(`${lang}: the boundary's error and its reset go to the screen untouched`, () => {
      const props = { error: fault(), reset: () => {} };
      const el = (Screen as (p: typeof props) => ReactElement<Record<string, unknown>>)(props);
      expect(el.type).toBe(PublicError);
      expect(el.props).toEqual({ lang, ...props });
      expect(el.props.reset).toBe(props.reset);
    });

    it(`${lang}: "${WORDS[lang].again}" fetches the page again and resets the boundary, in that order`, () => {
      const reset = vi.fn();
      // Called inside a render, where its hooks may run: the tree it returns
      // still has the button's handler, which the markup does not.
      let tree: ReactNode = null;
      const Probe = () => {
        tree = PublicError({ lang, error: fault(), reset });
        return null;
      };
      renderToStaticMarkup(h(Probe));
      const buttons = elements(tree).filter((el) => el.type === "button");
      expect(buttons).toHaveLength(1);
      expect(router.refresh).not.toHaveBeenCalled();
      expect(reset).not.toHaveBeenCalled();
      (buttons[0].props.onClick as () => void)();
      expect(router.refresh).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(router.refresh.mock.invocationCallOrder[0]).toBeLessThan(reset.mock.invocationCallOrder[0]);
      // The way home is a plain link: it has nothing to run.
      const home = elements(tree).filter((el) => el.type === "a");
      expect(home.map((el) => el.props.onClick)).toEqual([undefined, undefined]);
    });
  }
});

describe("public error screen: it stands on its own", () => {
  const file = "src/components/layout/public-error.tsx";
  const code = source(...file.split("/"));
  const html = draw(EnglishError);

  it("is a client file that reaches none of the site's copy: its only imports are packages", () => {
    // Every public page carries this file, and it has to stand when something
    // of the site's has failed. site.ts, the calculators' words and the city
    // pages' text must not come with it, so its few words are in it.
    expect(code).toMatch(/^"use client";/);
    const imports = [...code.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\bimport\s+(?:[\w*\s{},$]+?\s+from\s+)?["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports).toEqual(["react", "next/navigation"]);
    expect(code).not.toMatch(/\bimport\(/);
  });

  it("sends nothing anywhere and reads nothing from the error: the console keeps it", () => {
    expect(code).toContain("console.error(error);");
    expect(code).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|WebSocket|\.digest\b|\.message\b|\.stack\b/);
  });

  it("carries its own rules: every class in the markup has one, every rule is the screen's, and none is mp.css's", () => {
    const css = rules(html);
    const used = new Set([...body(html).matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
    const ruled = new Set([...css.matchAll(/\.(ttc-pe[\w-]*)/g)].map((m) => m[1]));
    expect([...used].sort()).toEqual([...ruled].sort());
    expect([...used].every((name) => /^ttc-pe(__[a-z]+(--[a-z]+)?)?$/.test(name))).toBe(true);
    // A selector that is not the screen's own could only be the two that paint the canvas under it.
    const selectors = css
      .replace(/@media[^{]*\{/g, "")
      .split("}")
      .map((rule) => rule.split("{")[0].trim())
      .filter(Boolean)
      .flatMap((list) => list.split(","));
    expect(selectors.filter((s) => !s.startsWith(".ttc-pe"))).toEqual(["body", "html:has(.ttc-pe)"]);
  });

  it("is in the site's colours and type: every colour is one of mp.css's, and the family is the one the site loads", () => {
    const css = rules(html);
    const site = source("src", "app", "(public)", "mp.css").toLowerCase();
    const hex = [...new Set([...css.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()))];
    expect(hex.sort()).toEqual(["#0b0c0d", "#7a5d1c", "#a8a9a5", "#c99a38", "#f6f4ef"]);
    for (const colour of hex) expect(site, colour).toContain(`: ${colour};`);
    // next/font registers the family under its own name (PublicShell.tsx): named here, it is the site's type wherever the site's stylesheet is in the document.
    expect(css).toContain("font-family:Geist,'Geist Fallback',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif");
    expect(source("src", "components", "ttc", "mp", "PublicShell.tsx")).toContain("const mpSans = Geist({");
  });
});
