/**
 * Hard-coded placeholders for fields not yet in the schema.
 * Tracked for backfill in GH issue (instructor, duration, category, streak, certificates).
 */

const CATEGORIES = ["Scripture", "Catechesis", "Leadership", "Seasonal"] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function placeholderCategory(courseId: string): string {
  return CATEGORIES[hashSeed(courseId) % CATEGORIES.length];
}

export function placeholderDuration(lessonCount: number): string {
  if (lessonCount <= 0) return "—";
  const hours = Math.max(1, Math.round(lessonCount * 0.25));
  return `≈${hours}h`;
}

export const CATEGORY_LIST: readonly string[] = ["All", ...CATEGORIES];
