import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireParishRole } from "@/lib/authz";
import { getCatalogCourses } from "@/lib/repositories/catalog";
import type { CatalogCourse } from "@/lib/repositories/catalog";

function CourseCard({ course }: { course: CatalogCourse }) {
  return (
    <Card className="flex h-full flex-col transition-colors hover:bg-secondary/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{course.title}</CardTitle>
          <span
            className={[
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              course.scope === "DIOCESE"
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-secondary-foreground",
            ].join(" ")}
          >
            {course.scope === "DIOCESE" ? "Diocese-wide" : "Parish"}
          </span>
        </div>
        {course.description && (
          <CardDescription className="line-clamp-2">
            {course.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""}
        </p>
        {course.enrolled ? (
          <Button asChild className="w-full" variant="outline">
            <Link href={`/app/courses/${course.id}`}>Go to course</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ask your parish admin to enroll you.
          </p>
        )}
      </CardContent>
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

  const enrolled = allCourses.filter((c) => c.enrolled);
  const unenrolled = allCourses.filter((c) => !c.enrolled);

  const filteredEnrolled =
    query.length > 0
      ? enrolled.filter(
          (c) =>
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
        )
      : enrolled;

  const filteredUnenrolled =
    query.length > 0
      ? unenrolled.filter(
          (c) =>
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
        )
      : unenrolled;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Course Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Browse available courses and track your enrolled ones.
        </p>
      </header>

      {/* Search */}
      <form className="flex gap-2">
        <label className="sr-only" htmlFor="catalog-search">
          Search courses
        </label>
        <Input
          className="max-w-sm"
          defaultValue={query}
          id="catalog-search"
          name="q"
          placeholder="Search courses..."
          type="search"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query && (
          <Button asChild type="button" variant="ghost">
            <Link href="/app/catalog">Clear</Link>
          </Button>
        )}
      </form>

      {/* Enrolled courses */}
      {filteredEnrolled.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            My enrolled courses
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEnrolled.map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
          </div>
        </section>
      )}

      {/* Available courses */}
      {filteredUnenrolled.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {query ? `Results for "${query}"` : "All available courses"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUnenrolled.map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
          </div>
        </section>
      )}

      {/* Empty states */}
      {allCourses.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No courses are available in the catalog yet.
            </p>
          </CardContent>
        </Card>
      )}
      {allCourses.length > 0 &&
        filteredEnrolled.length === 0 &&
        filteredUnenrolled.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No courses match your search.
              </p>
            </CardContent>
          </Card>
        )}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/app/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
