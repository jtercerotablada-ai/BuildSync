/**
 * Shared per-section bar palette for the Timeline + Gantt views.
 *
 * Every bar used to render the same Asana blue (Timeline keyed a few hues
 * off priority, which template tasks never set), so a real project read as
 * one undifferentiated wall of color. Both views now color bars BY SECTION
 * — Asana's "Color: by section" behavior — so each phase band is visually
 * distinct and an engineer can tell at a glance which phase a bar belongs
 * to.
 *
 * The palette cycles deterministically by the section's index in the
 * project's full section list (NOT the filtered list, so filtering never
 * reshuffles colors). `text` is the matching high-contrast label tint used
 * for text rendered inside the bar.
 */

export interface SectionBarStyle {
  bg: string;
  text: string;
}

export const SECTION_BAR_PALETTE: SectionBarStyle[] = [
  { bg: "#79ABFF", text: "#142B51" }, // blue
  { bg: "#FEA06A", text: "#4B1F00" }, // orange
  { bg: "#E39EF2", text: "#3F1F47" }, // purple
  { bg: "#83DBB5", text: "#0D3B26" }, // green
  { bg: "#F9AACB", text: "#571C33" }, // pink
  { bg: "#F8DF72", text: "#4A3B00" }, // yellow
  { bg: "#9EE7E3", text: "#0E3D3B" }, // aqua
  // Lavender, NOT gray — gray is reserved for the completed-bar state in
  // both views, and a gray section hue would make active bars read as done.
  { bg: "#B9A8F9", text: "#271B52" }, // lavender
];

/** Deterministic style for a section by its index in the section list. */
export function sectionBarStyle(index: number): SectionBarStyle {
  const n = SECTION_BAR_PALETTE.length;
  return SECTION_BAR_PALETTE[((index % n) + n) % n];
}
