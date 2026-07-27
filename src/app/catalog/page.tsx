import Link from "next/link";
import type { Metadata } from "next";

import { CourseThumbnail } from "@/components/learning/emblem";
import { CategoryChip, MetaRow } from "@/components/learning/meta-row";
import { PublicLearningHeader } from "@/components/public-learning-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCourseDuration } from "@/lib/course-metadata";
import { listPublicCatalogCourses } from "@/lib/repositories/courses";

export const metadata: Metadata = {
  title: "Course Catalog",
  description: "Browse our publicly available courses on faith, leadership, and parish life.",
};

export const dynamic = "force-dynamic";

export default async function PublicCatalogPage() {
  const courses = await listPublicCatalogCourses();

  return (
    <div className="min-h-screen bg-background">
      <PublicLearningHeader current="catalog" />
      <main className="mx-auto max-w-[1160px] px-5 pb-16 pt-14 sm:px-7 sm:pt-20">
        <header className="grid gap-8 border-b border-border pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] lg:items-end lg:gap-20">
          <div>
            <div className="mb-4 h-[2px] w-12 bg-gold" />
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              St. John Armenian Church
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
              Course catalog
            </h1>
          </div>
          <p className="max-w-[33rem] text-[17px] leading-relaxed text-muted-foreground">
            Explore courses that strengthen faith, leadership, and service in the life of the parish.
          </p>
        </header>

        {courses.length > 0 ? (
          <section aria-label="Available courses" className="grid gap-8 py-10 md:grid-cols-2 md:gap-10 lg:py-12">
            {courses.map((course) => {
              const duration = formatCourseDuration(course.durationHours);

              return (
                <Card
                  className="group flex h-full flex-col overflow-hidden rounded-[4px] border-border bg-card shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
                  key={course.id}
                >
                  <Link
                    aria-label={`View ${course.title}`}
                    className="relative block aspect-square overflow-hidden bg-muted"
                    href={`/courses/${course.id}`}
                  >
                    <CourseThumbnail alt={course.title} seed={course.id} thumbnailUrl={course.thumbnailUrl} />
                  </Link>
                  <CardContent className="flex flex-1 flex-col items-start px-6 py-6 sm:px-7">
                    {course.category ? <CategoryChip category={course.category} /> : null}
                    <h2 className="mt-4 font-display text-[25px] font-bold leading-tight tracking-tight text-foreground">
                      <Link className="transition-colors hover:text-primary" href={`/courses/${course.id}`}>
                        {course.title}
                      </Link>
                    </h2>
                    {course.description ? (
                      <p className="mt-3 max-w-[35rem] text-[15px] leading-relaxed text-muted-foreground">
                        {course.description}
                      </p>
                    ) : null}
                    <MetaRow className="mt-5" duration={duration} lessons={course.lessonCount} />
                    <Button asChild className="mt-7" size="lg">
                      <Link href={`/courses/${course.id}`}>View course</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : (
          <Card className="my-10 rounded-none">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No courses are currently available. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <footer className="border-t border-border bg-secondary/60">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-2 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p>St. John Armenian Church Learning</p>
          <Link className="font-semibold text-foreground hover:text-primary" href="/sign-in">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
