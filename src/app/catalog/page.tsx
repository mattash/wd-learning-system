import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { formatCourseDuration } from "@/lib/course-metadata";
import { listPublicCatalogCourses } from "@/lib/repositories/courses";

export const metadata: Metadata = {
  title: "Course Catalog",
  description: "Browse our publicly available courses on faith, leadership, and parish life.",
};

export default async function PublicCatalogPage() {
  const courses = await listPublicCatalogCourses();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Course Catalog</h1>
        <p className="text-muted-foreground">
          Browse our publicly available courses on faith, leadership, and parish life.
        </p>
      </header>

      {courses.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              className="group block"
              href={`/courses/${course.id}`}
              key={course.id}
            >
              <Card className="flex h-full flex-col overflow-hidden transition-colors hover:bg-secondary/50">
                <div className="flex gap-3 p-4 pb-0">
                  {/* Thumbnail */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={course.title}
                        className="h-full w-full object-cover"
                        src={course.thumbnailUrl}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base group-hover:underline">
                      {course.title}
                    </CardTitle>
                    {course.description && (
                      <CardDescription className="line-clamp-2 mt-0.5">
                        {course.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <CardContent className="mt-auto pt-3">
                  <p className="text-xs text-muted-foreground">
                    {[
                      `${course.moduleCount} module${course.moduleCount !== 1 ? "s" : ""}`,
                      course.category,
                      formatCourseDuration(course.durationHours),
                    ].filter(Boolean).join(" · ")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No courses are currently available. Check back soon.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
