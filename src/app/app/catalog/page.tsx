import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CourseThumbnail } from "@/components/learning/emblem";
import { ScopeBadge } from "@/components/learning/scope-badge";
import { CategoryChip, MetaRow } from "@/components/learning/meta-row";
import {
  CATEGORY_LIST,
  placeholderCategory,
  placeholderDuration,
} from "@/components/learning/placeholders";
import { RequestJoinButton } from "@/components/course-join/request-join-button";
import { requireParishRole } from "@/lib/authz";
import { getCatalogCourses } from "@/lib/repositories/catalog";
import { getStudentPendingRequests } from "@/lib/repositories/course-join-requests";
import type { CatalogCourse } from "@/lib/repositories/catalog";

function CourseCard({
  course,
  hasPendingRequest,
}: {
  course: CatalogCourse;
  hasPendingRequest: boolean;
}) {
  const category = placeholderCategory(course.id);
  const duration = placeholderDuration(course.lessonCount);

  return (
    <Card
      id={`course-${course.id}`}
      className="group flex h-full scroll-mt-24 flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
    >
      <Link
        aria-label={course.title}
        className="relative block aspect-video w-full"
        href={course.enrolled ? `/app/courses/${course.id}` : `#course-${course.id}`}
      >
        <div className="absolute inset-0">
          <CourseThumbnail alt={course.title} seed={course.id} thumbnailUrl={course.thumbnailUrl} />
        </div>
        <div className="absolute left-3 top-3 z-10">
          <ScopeBadge scope={course.scope} onMedia />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 px-5 py-4">
        <div>
          <CategoryChip category={category} />
        </div>
        <Link
          className="line-clamp-2 font-display text-[17px] font-bold leading-snug tracking-tight hover:text-primary"
          href={course.enrolled ? `/app/courses/${course.id}` : `#course-${course.id}`}
        >
          {course.title}
        </Link>
        {course.description && (
          <p className="line-clamp-2 text-[13.5px] leading-snug text-muted-foreground">
            {course.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <MetaRow lessons={course.lessonCount} duration={duration} />
          {course.enrolled ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/courses/${course.id}`}>Open</Link>
            </Button>
          ) : hasPendingRequest ? (
            <span className="whitespace-nowrap text-[12.5px] font-semibold text-success">
              Request sent
            </span>
          ) : (
            <RequestJoinButton courseId={course.id} />
          )}
        </div>
      </div>
    </Card>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const allCourses = await getCatalogCourses(parishId, clerkUserId);
  const params = (await searchParams) ?? {};

  const rawQ = params.q;
  const query = Array.isArray(rawQ) ? rawQ[0] : (rawQ?.trim() ?? "");
  const rawCat = params.category;
  const category = Array.isArray(rawCat) ? rawCat[0] : (rawCat ?? "All");
  const enrollmentStatus = Array.isArray(params.enrollment) ? params.enrollment[0] : params.enrollment;
  const showEnrollmentConfirmation = enrollmentStatus === "requested";

  const pendingRequests = await getStudentPendingRequests({ parishId, clerkUserId });
  const pendingCourseIds = new Set(pendingRequests.map((r) => r.courseId));

  const matchesQuery = (c: CatalogCourse) =>
    query.length === 0 ||
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false);

  const matchesCategory = (c: CatalogCourse) =>
    category === "All" || placeholderCategory(c.id) === category;

  const filtered = allCourses.filter((c) => matchesQuery(c) && matchesCategory(c));
  const enrolled = filtered.filter((c) => c.enrolled);
  const available = filtered.filter((c) => !c.enrolled);

  return (
    <div className="space-y-9">
      <header>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">
          Course Catalog
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Browse the diocese library and track the courses you&apos;re enrolled in.
        </p>
      </header>

      {showEnrollmentConfirmation ? (
        <Alert>
          <AlertDescription>
            Your enrollment request has been submitted. A parish admin will review it shortly.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Search + categories */}
      <div className="space-y-4">
        <form className="flex flex-wrap gap-2.5">
          <div className="relative w-full max-w-[460px]">
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              className="h-11 w-full rounded-[10px] pl-10 text-[14.5px]"
              defaultValue={query}
              id="catalog-search"
              name="q"
              placeholder="Search courses…"
              type="search"
            />
            {category !== "All" && (
              <input type="hidden" name="category" value={category} />
            )}
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {query && (
            <Button asChild type="button" variant="ghost">
              <Link
                href={category === "All" ? "/app/catalog" : `/app/catalog?category=${encodeURIComponent(category)}`}
              >
                Clear
              </Link>
            </Button>
          )}
        </form>
        <div className="flex flex-wrap gap-2.5">
          {CATEGORY_LIST.map((c) => {
            const isActive = category === c;
            const href =
              c === "All"
                ? query
                  ? `/app/catalog?q=${encodeURIComponent(query)}`
                  : "/app/catalog"
                : `/app/catalog?category=${encodeURIComponent(c)}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
            return (
              <Link
                key={c}
                href={href}
                className={
                  "inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors " +
                  (isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground")
                }
              >
                {c}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Enrolled */}
      {enrolled.length > 0 && (
        <section>
          <SectionHead title={`My enrolled courses · ${enrolled.length}`} />
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((course) => (
              <CourseCard
                course={course}
                hasPendingRequest={pendingCourseIds.has(course.id)}
                key={course.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available */}
      {available.length > 0 && (
        <section>
          <SectionHead
            title={
              query
                ? `Results for "${query}" · ${available.length}`
                : `${category === "All" ? "All courses" : category} · ${available.length}`
            }
          />
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((course) => (
              <CourseCard
                course={course}
                hasPendingRequest={pendingCourseIds.has(course.id)}
                key={course.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty states */}
      {allCourses.length === 0 && (
        <Card className="px-6 py-12 text-center text-[14px] text-muted-foreground">
          No courses are available in the catalog yet.
        </Card>
      )}
      {allCourses.length > 0 && enrolled.length === 0 && available.length === 0 && (
        <Card className="px-6 py-12 text-center text-[14px] text-muted-foreground">
          {query && category !== "All"
            ? "No courses match your filters."
            : query
              ? "No courses match your search."
              : "No courses match this category."}
        </Card>
      )}
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
    </div>
  );
}
