"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseLessonRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface QuestionDraft {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
}

function buildQuestionDrafts(lesson: DioceseLessonRow): QuestionDraft[] {
  return [...lesson.questions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      correctOptionIndex: question.correct_option_index,
    }));
}

export function AdminLessonQuestionManager({ lesson }: { lesson: DioceseLessonRow }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>(() => buildQuestionDrafts(lesson));

  useEffect(() => {
    setQuestionDrafts(buildQuestionDrafts(lesson));
  }, [lesson]);

  async function createQuestion() {
    const response = await fetch(`/api/admin/lessons/${lesson.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "New question",
        options: ["Option A", "Option B"],
        correctOptionIndex: 0,
        sortOrder: questionDrafts.length,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Question created." : data.error ?? "Failed to create question.");
    if (response.ok) router.refresh();
  }

  async function saveQuestion(questionId: string, sortOrder: number) {
    const draft = questionDrafts.find((candidate) => candidate.id === questionId);

    if (!draft) {
      setMessage("Unable to find question draft.");
      return;
    }

    const prompt = draft.prompt.trim();
    const options = draft.options.map((option) => option.trim()).filter(Boolean);

    if (!prompt) {
      setMessage("Question prompt is required.");
      return;
    }

    if (options.length < 2) {
      setMessage("Each question must have at least two options.");
      return;
    }

    const correctOptionIndex = Math.min(Math.max(draft.correctOptionIndex, 0), options.length - 1);

    const response = await fetch(`/api/admin/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        options,
        correctOptionIndex,
        sortOrder,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Create and edit quiz questions using separate option fields.</p>
        <Button onClick={createQuestion} type="button">
          Add question
        </Button>
      </div>

      {questionDrafts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No questions yet</CardTitle>
            <CardDescription>Add the first question to start building the lesson quiz.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        questionDrafts.map((question, questionIndex) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle>Question {questionIndex + 1}</CardTitle>
              <CardDescription>Set prompt text, options, and the correct answer below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                onChange={(event) =>
                  setQuestionDrafts((prev) =>
                    prev.map((candidate) =>
                      candidate.id === question.id ? { ...candidate, prompt: event.target.value } : candidate,
                    ),
                  )
                }
                placeholder="Question prompt"
                value={question.prompt}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium">Options</p>
                {question.options.map((option, optionIndex) => (
                  <div className="flex gap-2" key={`${question.id}-option-${optionIndex}`}>
                    <Input
                      onChange={(event) =>
                        setQuestionDrafts((prev) =>
                          prev.map((candidate) =>
                            candidate.id === question.id
                              ? {
                                  ...candidate,
                                  options: candidate.options.map((existingOption, existingIndex) =>
                                    existingIndex === optionIndex ? event.target.value : existingOption,
                                  ),
                                }
                              : candidate,
                          ),
                        )
                      }
                      placeholder={`Option ${optionIndex + 1}`}
                      value={option}
                    />
                    <Button
                      onClick={() =>
                        setQuestionDrafts((prev) =>
                          prev.map((candidate) => {
                            if (candidate.id !== question.id || candidate.options.length <= 2) {
                              return candidate;
                            }

                            const nextOptions = candidate.options.filter((_, existingIndex) => existingIndex !== optionIndex);
                            let nextCorrectOptionIndex = candidate.correctOptionIndex;

                            if (candidate.correctOptionIndex === optionIndex) {
                              nextCorrectOptionIndex = 0;
                            } else if (candidate.correctOptionIndex > optionIndex) {
                              nextCorrectOptionIndex = candidate.correctOptionIndex - 1;
                            }

                            return {
                              ...candidate,
                              options: nextOptions,
                              correctOptionIndex: nextCorrectOptionIndex,
                            };
                          }),
                        )
                      }
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() =>
                    setQuestionDrafts((prev) =>
                      prev.map((candidate) =>
                        candidate.id === question.id
                          ? { ...candidate, options: [...candidate.options, `Option ${candidate.options.length + 1}`] }
                          : candidate,
                      ),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Add option
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Correct answer</span>
                  <Select
                    onChange={(event) =>
                      setQuestionDrafts((prev) =>
                        prev.map((candidate) =>
                          candidate.id === question.id
                            ? { ...candidate, correctOptionIndex: Number.parseInt(event.target.value, 10) }
                            : candidate,
                        ),
                      )
                    }
                    value={String(question.correctOptionIndex)}
                  >
                    {question.options.map((option, optionIndex) => (
                      <option key={`${question.id}-correct-${optionIndex}`} value={String(optionIndex)}>
                        {option.trim() ? option : `Option ${optionIndex + 1}`}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveQuestion(question.id, questionIndex)} size="sm" type="button" variant="secondary">
                  Save question
                </Button>
                <Button onClick={() => deleteQuestion(question.id)} size="sm" type="button" variant="destructive">
                  Delete question
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
