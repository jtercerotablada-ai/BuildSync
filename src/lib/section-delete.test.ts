import { describe, expect, it } from "vitest";
import {
  sectionDeleteMessage,
  sectionDeletePrompt,
  sectionNameForSentence,
} from "./section-delete";

/**
 * Deleting a section hard-deletes every task in it, sub-tasks included, with
 * no undo. These tests are named after what the OWNER READS in the dialog,
 * not after the function, because the bug they lock down was a wording bug:
 * the Workflow builder asked "Delete this section and its 3 tasks?" over a
 * column that held twelve, and never said the delete was permanent.
 *
 * Pure strings — no database, no network, no DOM.
 */
describe("the section delete warning", () => {
  it("names the section and says the delete is permanent", () => {
    const msg = sectionDeleteMessage("Structural Calculations", 12);
    expect(msg).toBe(
      'Delete "Structural Calculations" and all 12 of its tasks (completed and hidden ones included, plus their sub-tasks)? This cannot be undone.'
    );
  });

  it("says the count covers what the screen is not showing", () => {
    // The whole reason the count is passed in raw: a filtered column showing
    // three cards can hold twelve rows. If this clause ever goes missing the
    // number reads as "the tasks I can see".
    const msg = sectionDeleteMessage("Permitting", 12);
    expect(msg).toContain("completed and hidden ones included");
    expect(msg).toContain("plus their sub-tasks");
  });

  it("says 'task' for exactly one", () => {
    expect(sectionDeleteMessage("Punch List", 1)).toBe(
      'Delete "Punch List" and all 1 of its task (completed and hidden ones included, plus their sub-tasks)? This cannot be undone.'
    );
  });

  it("does not threaten anything when the section is empty", () => {
    // An empty section is a one-click mistake to undo by hand. Claiming
    // "this cannot be undone" here would teach the owner to skip the
    // sentence on the section where it is true.
    const msg = sectionDeleteMessage("Closeout", 0);
    expect(msg).toBe('Delete "Closeout"?');
    expect(msg).not.toContain("cannot be undone");
    expect(msg).not.toContain("0");
  });

  it("falls back to the short question when the count is not a real count", () => {
    // rawSectionCounts is a lookup and can miss. "all NaN of its tasks" is
    // worse than not mentioning a number.
    for (const bad of [NaN, Infinity, -3]) {
      expect(sectionDeleteMessage("Site Visit", bad)).toBe(
        'Delete "Site Visit"?'
      );
    }
  });
});

describe("a section name inside the warning", () => {
  it("cannot close the quotes early and rewrite the rest of the sentence", () => {
    // A name containing a double quote would otherwise end the quoted slot
    // and make the warning's own words look like part of the name.
    const msg = sectionDeleteMessage('Phase "A"', 4);
    expect(msg.match(/"/g)).toHaveLength(2);
    expect(msg).toContain(`"Phase 'A'"`);
  });

  it("cannot forge a second line in a native confirm", () => {
    expect(sectionNameForSentence("Foundations\nDeleted nothing")).toBe(
      "Foundations Deleted nothing"
    );
    expect(sectionNameForSentence("  Roof   Framing  ")).toBe("Roof Framing");
  });

  it("truncates a pasted paragraph instead of burying the warning", () => {
    const long = "Structural ".repeat(40);
    const label = sectionNameForSentence(long);
    expect(label.length).toBeLessThanOrEqual(60);
    expect(label.endsWith("…")).toBe(true);
    // Still recognisable as the section the owner clicked.
    expect(label.startsWith("Structural Structural")).toBe(true);
  });

  it("keeps a short name exactly as it was typed", () => {
    expect(sectionNameForSentence("Design Development")).toBe(
      "Design Development"
    );
  });

  it("still asks a sensible question when the name is blank", () => {
    expect(sectionDeleteMessage("   ", 2)).toBe(
      'Delete "this section" and all 2 of its tasks (completed and hidden ones included, plus their sub-tasks)? This cannot be undone.'
    );
  });
});

describe("the dialog the warning is shown in", () => {
  it("makes the owner type the name when real work would be destroyed", () => {
    const prompt = sectionDeletePrompt("Structural Calculations", 12);
    expect(prompt.requireText).toBe("Structural Calculations");
    expect(prompt.title).toBe("Delete section");
    expect(prompt.confirmLabel).toBe("Delete section");
    expect(prompt.description).toBe(
      sectionDeleteMessage("Structural Calculations", 12)
    );
  });

  it("does not make the owner type anything to drop an empty section", () => {
    expect(sectionDeletePrompt("Closeout", 0).requireText).toBeUndefined();
  });

  it("asks for the name as typed, not as displayed", () => {
    // The sentence shows a shortened, requoted label; the thing the owner has
    // to type back must still be the real section name, or the gate is
    // impossible to pass.
    const name = `Phase "A" — ${"x".repeat(80)}`;
    const prompt = sectionDeletePrompt(name, 5);
    expect(prompt.requireText).toBe(name);
    expect(prompt.description).not.toContain(name);
  });

  it("does not gate a nameless section on typing nothing", () => {
    expect(sectionDeletePrompt("   ", 5).requireText).toBeUndefined();
  });

  it("asks for a name the owner can actually retype", () => {
    // The dialog prints requireText inside a plain <span>, and HTML collapses
    // any run of whitespace to one space. If the stored name kept its double
    // space the label would read "Site Visit", the owner would type exactly
    // that, the comparison would fail, and the section would be undeletable
    // from every view with no error explaining why.
    const prompt = sectionDeletePrompt("Site  Visit", 6);
    expect(prompt.requireText).toBe("Site Visit");
    // And it matches what the sentence above it spells out.
    expect(prompt.description).toContain('"Site Visit"');
  });

  it("asks for a name a single-line input can produce", () => {
    // Same trap, sharper: an <Input> cannot emit a newline or a tab at all,
    // so gating on one would be a gate with no key.
    expect(sectionDeletePrompt("Roof\nFraming\tB", 3).requireText).toBe(
      "Roof Framing B"
    );
  });
});
