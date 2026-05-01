"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface CompletionModalProps {
  score: number;
  courseTitle: string;
  lessonTitle: string;
  nextLesson: { id: string; title: string } | null;
  courseComplete?: boolean;
  certificateId?: string;
}

export function CompletionModal({
  score,
  courseTitle,
  lessonTitle,
  nextLesson,
  courseComplete = false,
  certificateId,
}: CompletionModalProps) {
  return (
    <div className="space-y-4">
      {/* Score card */}
      <Card className="border-success/30 bg-success-subtle">
        <CardContent className="py-6 text-center">
          <div className="mb-2 text-5xl font-bold text-success">{score}%</div>
          <p className="text-sm text-muted-foreground">
            Quiz passed
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lessonTitle} — {courseTitle}
          </p>
        </CardContent>
      </Card>

      {/* Course completion */}
      {courseComplete && (
        <Card className="border-primary/30 bg-brand-subtle">
          <CardContent className="py-6 text-center">
            <div className="mb-3 text-4xl">🎉</div>
            <p className="mb-2 font-bold text-primary">Course Complete!</p>
            <p className="mb-4 text-sm text-muted-foreground">
              You have finished all lessons in {courseTitle}. A certificate has been issued.
            </p>
            {certificateId && (
              <Button asChild>
                <Link href={`/app/certificates/${certificateId}`}>
                  View & Download Certificate
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next lesson / dashboard */}
      <div className="flex gap-3">
        {nextLesson ? (
          <Button asChild className="flex-1">
            <Link href={`/app/lessons/${nextLesson.id}`}>
              Next: {nextLesson.title} →
            </Link>
          </Button>
        ) : (
          <Button asChild className="flex-1">
            <Link href="/app/dashboard">Back to Dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  );
}