import { notFound } from "next/navigation";

import { YoutubePlayer } from "@/components/player/youtube-player";
import { QuizForm } from "@/components/quiz-form";
import { requireParishRole } from "@/lib/authz";
import { getBestScore, getLessonWithQuestions, getVideoProgress } from "@/lib/repositories/lessons";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const { parishId, clerkUserId } = await requireParishRole("student");

  const lesson = await getLessonWithQuestions(lessonId);
  if (!lesson) notFound();

  const progress = await getVideoProgress(lessonId, parishId, clerkUserId);
  const bestScore = await getBestScore(lessonId, parishId, clerkUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        <p className="text-sm text-slate-600">Best score: {bestScore}%</p>
      </div>
      <YoutubePlayer
        lessonId={lesson.id}
        parishId={parishId}
        resumeSeconds={progress?.last_position_seconds ?? 0}
        videoId={lesson.youtube_video_id}
      />
      <QuizForm
        lessonId={lesson.id}
        parishId={parishId}
        questions={(lesson.questions ?? []).map((q: { id: string; prompt: string; options: unknown }) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options as string[],
        }))}
      />
    </div>
  );
}
