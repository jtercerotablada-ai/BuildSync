/**
 * The one copy of what "Delete section" warns about.
 *
 * DELETE /api/sections/:id is the most destructive verb on the project
 * surface: it hard-deletes every task carrying that sectionId — sub-tasks
 * included — with no trash and no undo. Three views can fire it (List, Board
 * and the Workflow builder) and each carried its own confirmation string, so
 * the Workflow copy had already drifted away from the other two: it did not
 * name the section, did not say the count includes completed and hidden
 * tasks, and did not say the action is permanent.
 *
 * Worse, it counted `section.tasks.length` — the RENDERED rows, which hide
 * sub-tasks, hide whatever the active filter hides, and include multi-homed
 * guest tasks the delete does NOT touch (those keep their HOME section id).
 * A column showing 3 cards can hold 12 rows. The honest number is computed
 * server-side as `sectionTaskCounts` in the project page; every caller here
 * takes it as `rawTaskCount` and only falls back to a rendered length when
 * the prop is missing.
 *
 * Same move as task-span.ts and dependency-route.ts: the sentence lives in
 * one place so a fourth caller cannot invent a fourth truth. Pure string
 * building — no React, no DOM. See section-delete.test.ts.
 */

/** Longest section name spelled out inside the sentence. */
const MAX_NAME_IN_SENTENCE = 60;

/**
 * A section name as it can safely be dropped INSIDE the quoted slot of the
 * warning sentence.
 *
 * Section names are free text — the API constrains nothing but emptiness —
 * and the sentence quotes them. A name carrying a double quote closes the
 * quotes early, so the rest of the warning reads as part of the name; a name
 * carrying a newline splits a one-line native confirm into what looks like
 * two separate prompts. Both are ways to make the warning say something it
 * does not mean. Collapsed to one line, requoted, and truncated so a pasted
 * paragraph cannot push "This cannot be undone." off the bottom of a dialog.
 *
 * Never dropped or replaced wholesale: the entire point of the sentence is
 * to say WHICH section is about to go.
 */
export function sectionNameForSentence(name: string): string {
  const flat = name.replace(/\s+/g, " ").trim().replace(/"/g, "'");
  if (flat.length <= MAX_NAME_IN_SENTENCE) return flat;
  return `${flat.slice(0, MAX_NAME_IN_SENTENCE - 1).trimEnd()}…`;
}

/**
 * The warning itself. `rawTaskCount` must be the RAW server count, not a
 * rendered row count — see the module note.
 */
export function sectionDeleteMessage(
  name: string,
  rawTaskCount: number
): string {
  const label = sectionNameForSentence(name) || "this section";
  // Guarded rather than trusted: the count arrives from a
  // `rawSectionCounts?.[id] ?? section.tasks.length` lookup that can miss
  // entirely for a section created since the page loaded. Anything that is
  // not a real positive count gets the short sentence — "all NaN of its
  // tasks" would be worse than saying nothing about the count at all.
  if (!Number.isFinite(rawTaskCount) || rawTaskCount < 1) {
    return `Delete "${label}"?`;
  }
  const n = Math.floor(rawTaskCount);
  return `Delete "${label}" and all ${n} of its task${n > 1 ? "s" : ""} (completed and hidden ones included, plus their sub-tasks)? This cannot be undone.`;
}

/** Everything a ConfirmDialog needs to ask the question. */
export interface SectionDeletePrompt {
  title: string;
  description: string;
  confirmLabel: string;
  /** Undefined = no typed confirmation for this section. */
  requireText?: string;
}

export function sectionDeletePrompt(
  name: string,
  rawTaskCount: number
): SectionDeletePrompt {
  const holdsWork = Number.isFinite(rawTaskCount) && rawTaskCount >= 1;
  // Whitespace runs are COLLAPSED, not preserved, because ConfirmDialog shows
  // this string back to the user in an ordinary <span> ("Type X to confirm")
  // and HTML renders any run of spaces, tabs or newlines as a single space.
  // A section actually named "Site  Visit" (two spaces — nothing on the way
  // in normalizes it) would render as "Site Visit", the owner would type what
  // he sees, the exact comparison would never match, and the Delete button
  // would stay disabled with no error on screen: a section undeletable
  // through the UI. Gate on the same characters the DOM shows him.
  const typed = name.replace(/\s+/g, " ").trim();
  return {
    title: "Delete section",
    description: sectionDeleteMessage(name, rawTaskCount),
    confirmLabel: "Delete section",
    // Typing the name is reserved for a delete that destroys work — the rule
    // ConfirmDialog states for itself. An empty section is one click to
    // recreate, and gating that too would train the hand to type through the
    // gate on the section that actually holds a month of somebody's work.
    // A blank name is left ungated because there is nothing to type.
    requireText: holdsWork && typed ? typed : undefined,
  };
}
