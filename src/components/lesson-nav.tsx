import Link from "next/link";

import { Button } from "@/components/ui/button";

interface LessonNavProps {
  previousLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
}

export function LessonNav({ previousLesson, nextLesson }: LessonNavProps) {
  if (!previousLesson && !nextLesson) return null;

  return (
    <div className="flex items-start justify-between gap-4 px-8 pt-5">
      <div>
        {previousLesson ? (
          <>
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Previous
            </span>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/app/lessons/${previousLesson.id}`}>
                ← {previousLesson.title}
              </Link>
            </Button>
          </>
        ) : (
          <div />
        )}
      </div>
      <div className="text-right">
        {nextLesson ? (
          <>
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Next
            </span>
            <Button asChild size="sm">
              <Link href={`/app/lessons/${nextLesson.id}`}>
                {nextLesson.title} →
              </Link>
            </Button>
          </>
        ) : (
          <Button disabled size="sm">
            Course complete
          </Button>
        )}
      </div>
    </div>
  );
}
