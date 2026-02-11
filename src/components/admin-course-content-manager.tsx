"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseModuleRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminCourseContentManager({ courseId, modules }: { courseId: string; modules: DioceseModuleRow[] }) {
  const router = useRouter();
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [message, setMessage] = useState("");

  async function createModule() {
    const response = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newModuleTitle, sortOrder: modules.length }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Module created." : data.error ?? "Failed to create module.");
    if (response.ok) {
      setNewModuleTitle("");
      router.refresh();
    }
  }

  async function updateModule(moduleId: string, title: string, sortOrder: number) {
    const response = await fetch(`/api/admin/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sortOrder }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Module updated." : data.error ?? "Failed to update module.");
    if (response.ok) router.refresh();
  }

  async function deleteModule(moduleId: string) {
    const response = await fetch(`/api/admin/modules/${moduleId}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Module deleted." : data.error ?? "Failed to delete module.");
    if (response.ok) router.refresh();
  }

  async function createLesson(moduleId: string) {
    const response = await fetch(`/api/admin/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New lesson",
        youtubeVideoId: "dQw4w9WgXcQ",
        sortOrder: 0,
        passingScore: 80,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Lesson created." : data.error ?? "Failed to create lesson.");
    if (response.ok) router.refresh();
  }

  async function updateLesson(lessonId: string, lesson: { title: string; youtube_video_id: string; sort_order: number; passing_score: number }) {
    const response = await fetch(`/api/admin/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: lesson.title,
        youtubeVideoId: lesson.youtube_video_id,
        sortOrder: lesson.sort_order,
        passingScore: lesson.passing_score,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Lesson updated." : data.error ?? "Failed to update lesson.");
    if (response.ok) router.refresh();
  }

  async function deleteLesson(lessonId: string) {
    const response = await fetch(`/api/admin/lessons/${lessonId}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Lesson deleted." : data.error ?? "Failed to delete lesson.");
    if (response.ok) router.refresh();
  }

  async function createQuestion(lessonId: string) {
    const response = await fetch(`/api/admin/lessons/${lessonId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "New question",
        options: ["Option A", "Option B"],
        correctOptionIndex: 0,
        sortOrder: 0,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Question created." : data.error ?? "Failed to create question.");
    if (response.ok) router.refresh();
  }

  async function updateQuestion(questionId: string, question: { prompt: string; options: string[]; correct_option_index: number; sort_order: number }) {
    const response = await fetch(`/api/admin/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: question.prompt,
        options: question.options,
        correctOptionIndex: question.correct_option_index,
        sortOrder: question.sort_order,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Question updated." : data.error ?? "Failed to update question.");
    if (response.ok) router.refresh();
  }

  async function deleteQuestion(questionId: string) {
    const response = await fetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Question deleted." : data.error ?? "Failed to delete question.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="New module title" value={newModuleTitle} />
        <Button onClick={createModule} type="button">
          Add module
        </Button>
      </div>

      {modules.map((module, moduleIndex) => (
        <div className="space-y-3 rounded-md border border-border p-3" key={module.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Input defaultValue={module.title} id={`module-${module.id}`} />
            <Button
              onClick={() => {
                const input = document.getElementById(`module-${module.id}`) as HTMLInputElement | null;
                updateModule(module.id, input?.value ?? module.title, moduleIndex);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Save module
            </Button>
            <Button onClick={() => createLesson(module.id)} size="sm" type="button" variant="secondary">
              Add lesson
            </Button>
            <Button onClick={() => deleteModule(module.id)} size="sm" type="button" variant="destructive">
              Delete module
            </Button>
          </div>

          {module.lessons.map((lesson, lessonIndex) => (
            <div className="space-y-2 rounded-md border border-border p-3" key={lesson.id}>
              <div className="grid gap-2 md:grid-cols-4">
                <Input defaultValue={lesson.title} id={`lesson-title-${lesson.id}`} placeholder="Lesson title" />
                <Input
                  defaultValue={lesson.youtube_video_id}
                  id={`lesson-video-${lesson.id}`}
                  placeholder="YouTube video ID"
                />
                <Input
                  defaultValue={String(lesson.passing_score)}
                  id={`lesson-score-${lesson.id}`}
                  placeholder="Passing score"
                  type="number"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const title = (document.getElementById(`lesson-title-${lesson.id}`) as HTMLInputElement | null)?.value ?? lesson.title;
                      const youtube_video_id =
                        (document.getElementById(`lesson-video-${lesson.id}`) as HTMLInputElement | null)?.value ?? lesson.youtube_video_id;
                      const scoreRaw = (document.getElementById(`lesson-score-${lesson.id}`) as HTMLInputElement | null)?.value;
                      const passing_score = Number(scoreRaw ?? lesson.passing_score);
                      updateLesson(lesson.id, {
                        title,
                        youtube_video_id,
                        sort_order: lessonIndex,
                        passing_score,
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Save lesson
                  </Button>
                  <Button onClick={() => createQuestion(lesson.id)} size="sm" type="button" variant="secondary">
                    Add question
                  </Button>
                  <Button onClick={() => deleteLesson(lesson.id)} size="sm" type="button" variant="destructive">
                    Delete lesson
                  </Button>
                </div>
              </div>

              {lesson.questions.map((question, questionIndex) => (
                <div className="grid gap-2 rounded-md border border-border p-2 md:grid-cols-5" key={question.id}>
                  <Input defaultValue={question.prompt} id={`question-prompt-${question.id}`} placeholder="Prompt" />
                  <Input
                    defaultValue={question.options.join("|")}
                    id={`question-options-${question.id}`}
                    placeholder="Option A|Option B"
                  />
                  <Input
                    defaultValue={String(question.correct_option_index)}
                    id={`question-correct-${question.id}`}
                    placeholder="Correct index"
                    type="number"
                  />
                  <Button
                    onClick={() => {
                      const prompt = (document.getElementById(`question-prompt-${question.id}`) as HTMLInputElement | null)?.value ?? question.prompt;
                      const optionsRaw =
                        (document.getElementById(`question-options-${question.id}`) as HTMLInputElement | null)?.value ??
                        question.options.join("|");
                      const options = optionsRaw
                        .split("|")
                        .map((option) => option.trim())
                        .filter(Boolean);
                      const correctRaw =
                        (document.getElementById(`question-correct-${question.id}`) as HTMLInputElement | null)?.value ??
                        String(question.correct_option_index);
                      const correct_option_index = Number(correctRaw);
                      updateQuestion(question.id, {
                        prompt,
                        options,
                        correct_option_index,
                        sort_order: questionIndex,
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Save question
                  </Button>
                  <Button onClick={() => deleteQuestion(question.id)} size="sm" type="button" variant="destructive">
                    Delete question
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
