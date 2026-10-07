import { notFound } from "next/navigation";

/**
 * Every URL that matches no route, answered with the app's 404
 * (`../not-found.tsx`) and a 404 status.
 *
 * This used to need no file: `src/app/not-found.tsx` beside the single root
 * layout was Next's page for unmatched URLs. With a root layout per route
 * group (see `../layout.tsx`) there is no layout left for Next to wrap such a
 * page in, and an unmatched URL fell through to the framework's own unbranded
 * "404: This page could not be found." A catch-all inside a group is the
 * supported way to give unmatched URLs a root layout — this group's, which is
 * the same bare <html><body> the old root was.
 *
 * It matches only what nothing else does: static and dynamic routes always
 * win over a catch-all, and the more specific public catch-alls
 * (es/[...rest], services/[slug]/[...rest], resources/[[...rest]]) win under
 * their own prefixes. On the public host it is never reached at all — the
 * proxy answers every path that is not marketing before routing (see the host
 * split in src/proxy.ts), so the marketing site keeps its own 404. In
 * practice this serves a signed-in member of staff who mistyped an address,
 * and requests for files that do not exist.
 *
 * WHAT IT COSTS. The old page was prerendered; this one is thrown at request
 * time, and Next 16 answers a notFound() thrown during SSR with its error
 * shell — the right status, title and icons, an empty <body>, and the screen
 * built by the client. Same page for anyone with JavaScript, nothing without.
 *
 * WHY NOT global-not-found.tsx. That is Next's own answer for an app with
 * several root layouts, it is prerendered, and it was tried here: with
 * `experimental.globalNotFound` on, Next 16.2.6 served a page identical to the
 * old one — and then its only button was dead. "Back to home" changed the
 * address to /home and left the 404 on screen. Re-test it when the flag is
 * stable; until then this is the version that works.
 *
 * Nothing may be rendered here. A page that returned markup would answer 200
 * for every address on the app host; notFound() is what carries the status.
 * No metadata either: the 404 keeps the root layout's title, as before.
 */
export default function Page() {
  notFound();
}
