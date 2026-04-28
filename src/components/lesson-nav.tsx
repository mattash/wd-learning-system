import Link from "next/link";

import { Button } from "@/components/ui/button";

interface LessonNavProps {
  previousLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
}

export function LessonNav({ previousLesson, nextLesson }: LessonNavProps) {
  if (!previousLesson && !nextLesson) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex-1 text-left">
        {previousLesson ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/app/lessons/${previousLesson.id}`}>
              ←&nbsp;{previousLesson.title}
            </Link>
          </Button>
        ) : (
          <span className="invisible block text-sm">No previous lesson</span>
        )}
      </div>
      <div className="flex-1 text-right">
        {nextLesson ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/app/lessons/${nextLesson.id}`}>
              {nextLesson.title}&nbsp;→
            </Link>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">End of course</span>
        )}
      </div>
    </div>
  );
}
