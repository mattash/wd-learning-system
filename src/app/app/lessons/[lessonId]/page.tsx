import { notFound } from "next/navigation";

import { YoutubePlayer } from "@/components/player/youtube-player";
import { QuizForm } from "@/components/quiz-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
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
      <Card>
        <CardHeader>
          <CardTitle>{lesson.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Best score: {bestScore}%</p>
        </CardContent>
      </Card>
      {isE2ESmokeMode() ? (
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
      )}
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
