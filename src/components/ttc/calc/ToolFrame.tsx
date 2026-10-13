import React from 'react';

/**
 * AROUND A CALCULATOR'S TOOL, ON ITS PAGE — for the moment between the page
 * arriving and its script running.
 *
 * The server sends every calculator with its example solved: it never sees
 * what an address holds after the `#`, and that is where a case is
 * (shell/address.ts). So the recipient of a link was shown the example —
 * its form, its drawings, every number of it — under the address of
 * another beam, with nothing to say so, until the script had run and read
 * the address: seconds on a phone, and for good if the scripts never came.
 *
 * The page's own first script, here, runs before anything is drawn. If the
 * address holds a case (`#`, one lower-case letter, `=`, something: the
 * shape mp/lang.tsx carries to the other language) it MARKS this frame, and
 * while the frame is marked the tool is not shown: a line stands in its
 * place (calc.css). The calculator takes the mark off in the same commit
 * that puts on screen the case it read, or the line that says it could not
 * be read (shell/address.ts, `OPENING`: the same word, kept there because
 * the shell reaches for nothing outside itself).
 *
 * Without scripts at all nothing is marked: the example shows, under the
 * `<noscript>` line that says why it does not respond. With no case in the
 * address nothing is marked either, and the example is what the page is.
 *
 * The mark is not React's: it is on the element before React arrives, and
 * `suppressHydrationWarning` says that is meant. React never sets it and
 * never removes it.
 *
 * NOR IS THE SCRIPT AN ELEMENT OF REACT'S: it is the text of a holder
 * (`dangerouslySetInnerHTML`). In the page as the server sends it that is
 * the same thing, a script the browser runs as it reads the page. But a
 * calculator is also reached from another page of the site without a new
 * document (the catalogue, the menu), and there React makes the frame
 * itself. A script element it makes is never run, and React says so in the
 * console, as an error, in development; a holder's text is put in place
 * without a word, and is not run either. Nothing is marked then, and
 * nothing need be: the calculator is awake, and reads the address as it
 * arrives.
 *
 * THE LINE IS NOT TEXT OF THE PAGE. Its paragraph is empty, and the sentence
 * is an attribute of it (`data-line`) that the rule for a marked frame
 * writes out (calc.css, `content: attr(data-line)`). As the paragraph's text
 * it was kept off the page by one rule of the stylesheet and by nothing
 * else: where that rule did not reach — the stylesheet lost on its way,
 * whatever reads the markup as it is — every calculator said "this link
 * carries a beam of its own… nothing is shown here" above its example, under
 * a bare address. (The `hidden` attribute would not do: the site's reset
 * makes it final, mp.css, and a marked frame could not show the line.)
 *
 * THE SCRIPT RUNS ONCE, as the page is read. An address that changes before
 * the calculator is awake is not seen here: a link pasted over a page still
 * loading has the example under it until the calculator wakes and opens the
 * case, as it had before there was a frame, and an address made bare
 * meanwhile keeps the line until then. Not a listener on the address: the
 * calculator takes the mark off once, when it first looks (shell/address.ts,
 * `looked`), and a frame marked again after that would hide the tool for
 * good.
 */

/** The attribute that marks the frame while the case in the address is still to be opened. */
export const OPENING = 'data-opening';

// ES5, and nothing it could throw on: it runs in every browser that gets the page, ahead of everything else of this tool.
// The frame is the parent of the script's holder.
const MARK = `(function(s){if(/^#[a-z]=./.test(location.hash))s.parentNode.parentNode.setAttribute('${OPENING}','')})(document.currentScript)`;

export function ToolFrame({ opening, children }: { /** The line shown in place of the tool while it is marked. */ opening: string; children: React.ReactNode }) {
  return (
    <div className="mp-app__frame" suppressHydrationWarning>
      <span hidden dangerouslySetInnerHTML={{ __html: `<script>${MARK}</script>` }} />
      <p className="mp-app__opening" data-line={opening} />
      {children}
    </div>
  );
}
