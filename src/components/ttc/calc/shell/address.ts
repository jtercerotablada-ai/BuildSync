'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsoLayoutEffect } from './layout';

/**
 * THE CALCULATORS' SHELL — the address follows the case. (What the shell is,
 * and a calculator built on it: index.ts.)
 *
 * Whatever is on a calculator's screen is in the page's address after the
 * `#` (`#b=…` for the first calculator, `#s=…` for the second, `#c=…` for
 * the third: a key of one lower-case letter, which is what the header's
 * language link carries — mp/lang.tsx, CARRIED). A browser does not send
 * that part to a server. A reload, a tab the phone discarded, the language
 * switch and "Copy link" all come back to the same case. The example leaves
 * the address bare, and a bare address is the example.
 *
 * This hook knows nothing about beams. It is given the key, the example as
 * the address would write it, the case on screen as the address would write
 * it, how to read a fragment, and how to put a case on screen; it does the
 * reading, the waiting and the writing.
 */

/*
 * Sent to the window each time this page rewrites its own address: nothing
 * else tells the header, whose language link is built from the address
 * (mp/lang.tsx listens, under the same name). An event and not an import:
 * that file reads the site's whole copy, which this script must not carry.
 */
const ADDRESS_EVENT = 'mp:address';

/*
 * The mark on the frame around a calculator (calc/ToolFrame.tsx, under the
 * same name: the shell reaches for nothing outside itself), put there by
 * the page's own first script, before any script of the site runs, when the
 * address holds a case: while it is there the page does not show the example
 * the server sent, which is not the case in the link. It comes off here,
 * once the address has been read — in the commit that puts on screen what
 * it held. Where the frame is not marked — a bare address, a page reached
 * without a new document — nothing is done.
 */
const OPENING = 'data-opening';

/*
 * The mark on the field that has the focus, for the moment a case from the
 * address is put on screen: `data-ended` (calc/NumField.tsx reads it, under
 * the same name). An edit in progress is an edit of the case before, and the
 * calculator ends it — its `open` leaves that field. A field left that way
 * has not been left by the visitor, and must not speak of the text it held:
 * a Length emptied on one beam said "the field was left empty: the value is
 * still 20" under the beam Back had brought, where nobody had emptied it.
 */
const ENDED = 'ended';

export interface AddressOptions<C> {
  /** What this calculator's case is called in its address: one lower-case letter, `#<key>=…`. */
  key: string;
  /** The example, as the address would write it — which it does not: the example's address is the bare one. */
  example: string;
  /**
   * The case on screen, as the address writes it. A function, called when
   * the address is written and not before: what is written may depend on
   * what the visitor is doing at that moment (the first calculator's Length
   * field, still being typed in).
   *
   * It must be THE SAME FUNCTION for as long as the case is the same
   * (`useCallback` over the case): the address is written 300 ms after it
   * last changed, and each time a case is put on screen anew.
   */
  code: () => string;
  /**
   * What the fragment of an address opens. `undefined`: it is not this
   * calculator's (`#main` is a place on the page). `null`: it is, and cannot
   * be read. Called with `window.location.hash`, the `#` included.
   */
  read: (hash: string) => C | null | undefined;
  /** The example: what a bare address opens, and what is shown in place of a link that cannot be read. */
  blank: () => C;
  /**
   * Puts a case on screen: the form, and whatever else is part of the case.
   * A place pointed at on the case before is not a place on this one:
   * forgotten here too. So is an edit in progress: the field that has the
   * focus is left here, before the case is loaded — and while this runs
   * that field is marked as left by the page (`ENDED`).
   */
  open: (found: C) => void;
  /**
   * Whether a fragment is this calculator's to rewrite or remove. Left out:
   * the ones that begin with its own key. (The single-span page reads the
   * first calculator's key as well, and gives its own.)
   */
  owns?: (hash: string) => boolean;
  /**
   * Whether a press is part of typing in a field whose edit is not final:
   * the address is not brought up to date for that one. (A press inside the
   * first calculator's Length field, while it is being typed in.)
   */
  typing?: (press: Event) => boolean;
}

export interface Address {
  /** A case was in the address and could not be read: the example is shown, and the page must say so — a recipient must not take the example for the case that was sent. Withdrawn as soon as the address is this page's own again. */
  linkError: boolean;
  /**
   * The link that opens `code`: the page and the case, and nothing else —
   * not the query string the visitor arrived with (an ad's click identifier,
   * a campaign tag), which would travel to everyone the link is sent to.
   * In a browser only (a handler, an effect): it reads the window's address.
   */
  link: (code: string) => string;
  /**
   * The address is written NOW, as `code`, and nothing is left waiting: for
   * an edit that is final. Whatever reads the address next — the language
   * link, a reload — must find this case, not wait 300 ms for it. (A link
   * that could not be read stays in the address while the case is still the
   * example.)
   */
  write: (code: string) => void;
  /**
   * The address is brought to `code` — which for the example is the bare
   * address — and a link that could not be read has nothing left to say:
   * the case in hand is the one on screen. For "Copy link" and "Start over".
   */
  take: (code: string) => void;
  /** What is waiting to be written is written at once: before the page is loaded again, which comes back to its address. */
  flush: () => void;
}

export function useAddress<C>(given: AddressOptions<C>): Address {
  const { key, example, code: current } = given;
  // What the address carries after the #: this page's key, then the case.
  const prefix = `#${key}=`;
  const [linkError, setLinkError] = useState(false);
  // The address has been read, and what it holds — a case, a link that
  // cannot be read, nothing of this calculator's — is on its way to the
  // screen in this very render.
  const [looked, setLooked] = useState(false);
  // A link that could not be read is left in the address, for the visitor to look at.
  const unread = useRef(false);
  // The address still to be written, if the case has changed since the last time.
  const pending = useRef<(() => void) | null>(null);
  // The fragment as this hook last read or wrote it. Any other one in the
  // address is somebody else's doing: Back, Forward, a link pasted over the
  // page. What was waiting to be written must not land on it — on the
  // history entry of the case that is about to open.
  const seen = useRef<string | null>(null);
  // What the calculator gave at its last render, for what runs later: the
  // listeners below are set once, and must not be set again — still less
  // read the address again — each time the calculator draws itself.
  const latest = useRef(given);
  useIsoLayoutEffect(() => {
    latest.current = given;
  });

  // A case in the address opens as that case.
  useEffect(() => {
    const show = (found: C, failed: boolean) => {
      // The field with the focus is `open`'s to leave, not the visitor's: marked so while it is done.
      const focused = document.activeElement;
      const field = focused instanceof HTMLInputElement ? focused : null;
      if (field) field.dataset[ENDED] = '';
      try {
        latest.current.open(found);
      } finally {
        if (field) delete field.dataset[ENDED];
      }
      // What was waiting to be written is the case of before: it is not to
      // land on the address this one came from.
      pending.current = null;
      unread.current = failed;
      setLinkError(failed);
    };
    // The page this calculator is on. `popstate` tells of every entry of the
    // site's history, not only of this page's: Back to the catalogue arrives
    // here too, while this calculator is still on screen for a moment.
    const here = window.location.pathname;
    const look = (changed?: Event) => {
      // Another page's address: this one is being left, and what that
      // address holds is not this calculator's to open — nor is the bare
      // address of the page before a reason to show the example on the way out.
      if (window.location.pathname !== here) return;
      seen.current = window.location.hash;
      // Said in state, so that it is a render — where a frame is marked. With
      // no mark there is nothing to take off, and no render to ask for.
      if (document.querySelector(`[${OPENING}]`)) setLooked(true);
      const found = latest.current.read(window.location.hash);
      if (found === undefined) {
        // Back to the bare address is back to the example: that is what a
        // bare address opens. Any other fragment (`#main`) is a place on
        // this page, reached from the case on screen: the case stays.
        if (changed && window.location.hash === '') show(latest.current.blank(), false);
        return;
      }
      // Not a case: the example is shown, and the page says so — a recipient
      // must not take the example for the case that was sent.
      show(found === null ? latest.current.blank() : found, found === null);
    };
    look();
    // The address changing under the page — a link pasted over this one,
    // Back, Forward — is told twice: `popstate` in the very task that changes
    // it, `hashchange` in a later one. It is read at the first. Between the
    // two the delayed write below could fire, find in the address a case
    // that was not the one on screen, and write the old case over it: the
    // link opened nothing. (Read again at the second, which finds the same.)
    window.addEventListener('popstate', look);
    window.addEventListener('hashchange', look);
    return () => {
      window.removeEventListener('popstate', look);
      window.removeEventListener('hashchange', look);
    };
  }, []);

  // …and the screen is this hook's to answer for from the commit that shows
  // what it read: the frame's mark comes off in that commit, not before (the
  // example would show for a frame) and not after.
  useIsoLayoutEffect(() => {
    if (looked) document.querySelector(`[${OPENING}]`)?.removeAttribute(OPENING);
  }, [looked]);

  // The address follows the case.
  const put = useCallback((code: string) => {
    const want = code === example ? '' : `${prefix}${code}`;
    if (want) {
      unread.current = false;
      setLinkError(false);
    }
    // Only a fragment that is this calculator's: `#main` is a place on the
    // page, and is nobody's to remove.
    const mine = latest.current.owns ? latest.current.owns(window.location.hash) : window.location.hash.startsWith(prefix);
    const have = mine ? window.location.hash : '';
    if (have === want || (!want && unread.current)) return;
    try {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + want);
    } catch {
      /* the address is a convenience; the calculator works without it */
    }
    window.dispatchEvent(new Event(ADDRESS_EVENT));
    // As the browser now has it, which need not be character for character what it was given.
    seen.current = window.location.hash;
  }, [example, prefix]);
  // Waited for, not written on every keystroke: Safari refuses more than a
  // hundred history changes in thirty seconds, and a field being typed in
  // passes through values nobody meant.
  useEffect(() => {
    const now = () => {
      pending.current = null;
      // Not the address this hook left: it changed under the case on screen.
      // If what is there now is a case of this calculator, or nothing at
      // all, it is on its way to being opened (`look`), and this write is
      // the case of before: dropped. Any other fragment (`#main`) is a place
      // on the page, and the case is written over it as it always was. Seen
      // once, the new address is the one to keep to: were nothing to open
      // it after all, the next edit is written again.
      const at = window.location.hash;
      if (at !== seen.current) {
        seen.current = at;
        if (at === '' || (latest.current.owns ? latest.current.owns(at) : at.startsWith(prefix))) return;
      }
      put(current());
    };
    pending.current = now;
    const id = window.setTimeout(() => {
      // Still the one waiting: not written already, not overtaken by a link.
      if (pending.current === now) now();
    }, 300);
    return () => window.clearTimeout(id);
  }, [current, put, prefix]);
  // …and is brought up to date at once when the visitor reaches for something
  // else: the language link is built from the address (lang.tsx,
  // useCarriedHash) and must not open the case of a moment ago; a phone may
  // discard a tab that is put away, and reloads it from its address. On the
  // click as well as the press: not every browser moves the focus to a link
  // that is clicked, and a tap need not take it from the field.
  //
  // AND AT THE RELOAD KEY. A reload comes back to the address as it stands
  // when the browser begins it: a key, then F5 inside the wait, and the case
  // came back without that key — "1234" typed, "123" on screen — and so with
  // a choice in a list, a row added, the units. The page hears the reload key
  // before the browser acts on it (F5, Ctrl+R or Cmd+R, with Shift or Ctrl for
  // the hard one), so what is waiting is written at that key — the Length
  // field's edit too, as leaving the field makes it (`code`). Where a browser
  // does not hand the key to the page, nothing changes; the wait stays for
  // every other key.
  useEffect(() => {
    const flush = (press?: Event) => {
      if (press && latest.current.typing?.(press)) return;
      pending.current?.();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const reloading = (press: KeyboardEvent) => {
      if (press.key === 'F5' || ((press.ctrlKey || press.metaKey) && !press.altKey && (press.key === 'r' || press.key === 'R'))) pending.current?.();
    };
    window.addEventListener('pointerdown', flush, true);
    window.addEventListener('focusin', flush, true);
    window.addEventListener('click', flush, true);
    window.addEventListener('keydown', reloading, true);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pointerdown', flush, true);
      window.removeEventListener('focusin', flush, true);
      window.removeEventListener('click', flush, true);
      window.removeEventListener('keydown', reloading, true);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  return {
    linkError,
    link: (code) => `${window.location.origin}${window.location.pathname}${prefix}${code}`,
    write: (code) => {
      pending.current = null;
      put(code);
    },
    take: (code) => {
      unread.current = false;
      setLinkError(false);
      pending.current = null;
      put(code);
    },
    flush: () => pending.current?.(),
  };
}
