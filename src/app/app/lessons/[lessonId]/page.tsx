import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DocumentReviewCard } from "@/components/document-review-card";
import { LessonNav } from "@/components/lesson-nav";
import { YoutubePlayer } from "@/components/player/youtube-player";
import { QuizForm } from "@/components/quiz-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import {
  getBestScore,
  getLessonNavContext,
  getLessonProgress,
  getLessonWithQuestions,
  isUserEnrolledForLesson,
} from "@/lib/repositories/lessons";

function buildDocumentViewerUrl({
  documentUrl,
  pageStart,
}: {
  documentUrl: string;
  pageStart: number | null;
}) {
  if (!pageStart || documentUrl.includes("#")) {
    return documentUrl;
  }

  return `${documentUrl}#page=${pageStart}`;
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const { parishId, clerkUserId } = await requireParishRole("student");
  const enrolled = await isUserEnrolledForLesson({ lessonId, parishId, clerkUserId });
  if (!enrolled) {
    redirect("/app/courses?error=not_enrolled");
  }

  const lesson = await getLessonWithQuestions(lessonId);
  if (!lesson) notFound();

  const progress = await getLessonProgress(lessonId, parishId, clerkUserId);
  const bestScore = await getBestScore(lessonId, parishId, clerkUserId);
  const navContext = await getLessonNavContext(lessonId);
  const documentViewerUrl =
    lesson.content_type === "DOCUMENT" && lesson.document_url
      ? buildDocumentViewerUrl({
          documentUrl: lesson.document_url,
          pageStart: lesson.document_page_start,
        })
      : null;
  const pageRangeLabel =
    lesson.document_page_start && lesson.document_page_end
      ? `Pages ${lesson.document_page_start}-${lesson.document_page_end}`
      : lesson.document_page_start
        ? `Page ${lesson.document_page_start}`
        : "Assigned document";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {navContext && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Button asChild className="h-auto p-0" variant="link">
            <Link href={`/app/courses/${navContext.course.id}`}>
              {navContext.course.title}
            </Link>
          </Button>
          <span>{">"}</span>
          <span className="text-foreground">{navContext.module.title}</span>
          <span>{">"}</span>
          <span className="font-medium text-foreground">{lesson.title}</span>
        </nav>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{lesson.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {lesson.descriptor ? <p className="mb-2 text-sm text-muted-foreground">{lesson.descriptor}</p> : null}
          {lesson.content_type === "DOCUMENT" ? (
            <p className="text-sm text-muted-foreground">
              Review status: {progress?.completed ? "Reviewed" : "Pending"} · {pageRangeLabel}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">Best score: {bestScore}%</p>
        </CardContent>
      </Card>
      {lesson.content_type === "VIDEO" && lesson.youtube_video_id ? (
        isE2ESmokeMode() ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Video player placeholder (e2e mode).</p>
            </CardContent>
          </Card>
        ) : (
          <YoutubePlayer
            lessonId={lesson.id}
            parishId={parishId}
            resumeSeconds={progress?.last_position_seconds ?? 0}
            videoId={lesson.youtube_video_id}
          />
        )
      ) : lesson.content_type === "DOCUMENT" && lesson.document_url && documentViewerUrl ? (
        <>
          <DocumentReviewCard
            documentLabel={pageRangeLabel}
            documentUrl={documentViewerUrl}
            initiallyCompleted={Boolean(progress?.completed)}
            lessonId={lesson.id}
            parishId={parishId}
          />
          <Card>
            <CardHeader>
              <CardTitle>Assigned reading</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                className="h-[720px] w-full rounded-md border border-border"
                src={documentViewerUrl}
                title={`${lesson.title} document`}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">This lesson is missing its content configuration.</p>
          </CardContent>
        </Card>
      )}

      {/* Prev/Next navigation */}
      {navContext && (
        <LessonNav
          previousLesson={navContext.previousLesson}
          nextLesson={navContext.nextLesson}
        />
      )}

      <QuizForm
        lessonId={lesson.id}
        parishId={parishId}
        questions={(lesson.questions ?? []).map((q: { id: string; prompt: string; options: unknown }) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options as string[],
        }))}
        nextLesson={navContext?.nextLesson ?? null}
      />
    </div>
  );
}
