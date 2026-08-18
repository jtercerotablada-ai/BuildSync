/**
 * The hero photograph for a client project page.
 *
 * These are the firm's own licensed architectural stock images (the curated set
 * under public/ttc/img/site), NOT photographs of the client's property — so the
 * shortlist is deliberately made of facade crops, skyline context and detail
 * shots that read as design, never as "here is your building". The page gives
 * them an empty alt and no caption for the same reason.
 *
 * The pick is a pure function of the project id, so a given project always
 * shows the same image on every visit and across deploys — a hero that shuffled
 * between page loads would look broken.
 *
 * When a real per-project cover photo exists (a Project.coverImageUrl column),
 * that takes precedence and this becomes the fallback.
 */
const HERO_IMAGES = [
  "midrise-balconies",
  "midrise-glass-balconies",
  "midrise-clean",
  "miami-condo-aerial",
  "miami-residential-towers",
  "recert-balconies-bw",
  "frame-curved-balconies",
  "miami-beach-dusk",
] as const;

/** FNV-1a — small, stable, and not dependent on any runtime hashing API. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function heroImageFor(projectId: string): string {
  const name = HERO_IMAGES[hash(projectId) % HERO_IMAGES.length];
  return `/ttc/img/site/${name}.jpg`;
}
