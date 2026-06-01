export const COURSE_CATEGORIES = [
  "Scripture",
  "Catechesis",
  "Leadership",
  "Seasonal",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const COURSE_CATEGORY_LIST = [
  "All",
  ...COURSE_CATEGORIES,
] as const;

export function parseDurationHours(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const duration = typeof value === "number" ? value : Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export function formatCourseDuration(value: number | string | null | undefined): string | null {
  const duration = parseDurationHours(value);
  if (duration === null) return null;

  const formatted = Number.isInteger(duration)
    ? String(duration)
    : duration.toFixed(1).replace(/\.0$/, "");
  return `~${formatted}h`;
}
