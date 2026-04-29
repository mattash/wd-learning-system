import { notFound, redirect } from "next/navigation";

import { CourseSidebar } from "@/components/course-sidebar";
import { DocumentReviewCard } from "@/components/document-review-card";
import { LessonNav } from "@/components/lesson-nav";
import { YoutubePlayer } from "@/components/player/youtube-player";
import { QuizForm } from "@/components/quiz-form";
import { requireParishRole } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getCourseTreeWithProgress } from "@/lib/repositories/courses";
import {
  getBestScore,
  getCourseIdForLesson,
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

  const [progress, bestScore, navContext, courseId] = await Promise.all([
    getLessonProgress(lessonId, parishId, clerkUserId),
    getBestScore(lessonId, parishId, clerkUserId),
    getLessonNavContext(lessonId),
    getCourseIdForLesson(lessonId),
  ]);

  const courseTree = courseId
    ? await getCourseTreeWithProgress(courseId, parishId, clerkUserId)
    : null;

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
    <div className="-mx-6 -mt-7 flex" style={{ height: "calc(100vh - 52px)" }}>
      {/* Sidebar */}
      {courseTree && (
        <CourseSidebar
          courseId={courseTree.course.id}
          courseTitle={courseTree.course.title}
          currentLessonId={lessonId}
          modules={courseTree.modules}
        />
      )}

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[820px] pb-20">
          {/* Video player */}
          {lesson.content_type === "VIDEO" && lesson.youtube_video_id ? (
            <div className="relative w-full bg-vid-bg">
              {isE2ESmokeMode() ? (
                <div className="flex aspect-video items-center justify-center">
                  <p className="text-[13px] text-primary-foreground/50">Video player placeholder (e2e mode)</p>
                </div>
              ) : (
                <YoutubePlayer
                  lessonId={lesson.id}
                  parishId={parishId}
                  resumeSeconds={progress?.last_position_seconds ?? 0}
                  videoId={lesson.youtube_video_id}
                />
              )}
            </div>
          ) : lesson.content_type === "DOCUMENT" && lesson.document_url && documentViewerUrl ? (
            <div className="mx-8 mt-7">
              <DocumentReviewCard
                documentLabel={pageRangeLabel}
                documentUrl={documentViewerUrl}
                initiallyCompleted={Boolean(progress?.completed)}
                lessonId={lesson.id}
                parishId={parishId}
              />
            </div>
          ) : null}

          {/* Lesson header */}
          <div className="px-8 pt-7">
            {navContext && (
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                {navContext.module.title}
              </div>
            )}
            <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">
              {lesson.title}
            </h1>
            {lesson.descriptor ? (
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {lesson.descriptor}
              </p>
            ) : null}
            {bestScore > 0 && (
              <p className="mt-2 text-[13px] text-muted-foreground">Best score: {bestScore}%</p>
            )}
          </div>

          {/* Document viewer iframe */}
          {lesson.content_type === "DOCUMENT" && documentViewerUrl ? (
            <div className="mx-8 mt-6">
              <iframe
                className="h-[720px] w-full rounded-lg border border-border"
                src={documentViewerUrl}
                title={`${lesson.title} document`}
              />
            </div>
          ) : null}

          {/* Quiz */}
          <div className="mt-6 px-8">
            <QuizForm
              lessonId={lesson.id}
              nextLesson={navContext?.nextLesson ?? null}
              parishId={parishId}
              questions={(lesson.questions ?? []).map((q: { id: string; prompt: string; options: unknown }) => ({
                id: q.id,
                prompt: q.prompt,
                options: q.options as string[],
              }))}
            />
          </div>

          {/* Prev/Next navigation */}
          {navContext && (
            <LessonNav
              nextLesson={navContext.nextLesson}
              previousLesson={navContext.previousLesson}
            />
          )}
        </div>
      </main>
    </div>
  );
}
