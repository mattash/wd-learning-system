"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface Question {
  id: string;
  prompt: string;
  options: string[];
}

export function QuizForm({
  lessonId,
  parishId,
  questions,
  nextLesson,
}: {
  lessonId: string;
  parishId: string;
  questions: Question[];
  nextLesson: { id: string; title: string } | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctIndices, setCorrectIndices] = useState<Record<string, number>>({});

  if (questions.length === 0) return null;

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    const orderedAnswers = questions.map((q) => answers[q.id] ?? -1);
    const response = await fetch("/api/quiz-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, parishId, answers: orderedAnswers }),
    });

    const data = await response.json();
    if (response.ok) {
      setScore(data.score);
      setSubmitted(true);
      if (data.correctIndices) {
        const map: Record<string, number> = {};
        questions.forEach((q, i) => {
          map[q.id] = data.correctIndices[i];
        });
        setCorrectIndices(map);
      }
    }
  };

  return (
    <div className="space-y-6">
      {questions.map((q, qIdx) => {
        const selectedIdx = answers[q.id];
        const correctIdx = correctIndices[q.id];
        const hasCorrectInfo = correctIdx !== undefined;

        return (
          <div
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors"
            key={q.id}
          >
            {/* Card header */}
            <div className="flex items-center gap-2.5 border-b border-border bg-surface-raised px-5 py-3.5">
              <span className="inline-flex items-center gap-[5px] rounded-full bg-brand-subtle px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-wide text-primary">
                Multiple Choice
              </span>
              <span className="ml-auto text-[12px] text-muted-foreground">
                Question {qIdx + 1} of {questions.length}
              </span>
            </div>

            {/* Card body */}
            <div className="px-5 py-5">
              <div className="mb-4 text-[15.5px] font-semibold leading-snug text-foreground">
                {q.prompt}
              </div>

              {/* Options */}
              <div className="flex flex-col gap-[9px]">
                {q.options.map((option, idx) => {
                  const isSelected = selectedIdx === idx;
                  const isCorrect = hasCorrectInfo && correctIdx === idx;
                  const isWrong = hasCorrectInfo && isSelected && correctIdx !== idx;

                  let borderClass = "border-border";
                  let bgClass = "bg-card";
                  let radioClass = "border-border-strong";
                  let badge = "";

                  if (submitted && isCorrect) {
                    borderClass = "border-success";
                    bgClass = "bg-success-subtle";
                    radioClass = "border-success bg-success";
                    badge = "✓";
                  } else if (submitted && isWrong) {
                    borderClass = "border-destructive";
                    bgClass = "bg-destructive-subtle";
                    radioClass = "border-destructive bg-destructive";
                    badge = "✗";
                  } else if (isSelected && !submitted) {
                    borderClass = "border-primary";
                    bgClass = "bg-brand-subtle";
                    radioClass = "border-primary bg-primary";
                  }

                  return (
                    <button
                      className={`flex items-start gap-3 rounded-lg border-[1.5px] px-3.5 py-3 text-left transition-all ${borderClass} ${bgClass} ${
                        submitted ? "cursor-default" : "cursor-pointer hover:border-brand-muted hover:bg-brand-subtle"
                      }`}
                      disabled={submitted}
                      key={idx}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: idx }))
                      }
                      type="button"
                    >
                      {/* Radio indicator */}
                      <div
                        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all ${radioClass}`}
                      >
                        {(isSelected || (submitted && isCorrect)) && (
                          <div className="h-[7px] w-[7px] rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <span className="flex-1 text-[14px] leading-relaxed text-foreground">
                        {option}
                      </span>
                      {badge && (
                        <span className="ml-auto shrink-0 self-center text-[18px]">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {submitted && score !== null && (
                <div
                  className={`mt-3.5 rounded-lg border p-3.5 text-[13.5px] leading-relaxed ${
                    score >= 100
                      ? "border-success bg-success-subtle text-success"
                      : "border-destructive bg-destructive-subtle text-destructive"
                  }`}
                >
                  <div className="mb-1 font-bold">
                    {score >= 100 ? "✓ Correct!" : `Score: ${score}%`}
                  </div>
                  {score >= 100
                    ? "Great work — move on when ready."
                    : "Review the questions above and try again."}
                </div>
              )}
            </div>

          </div>
        );
      })}

      {/* Submit / Next footer */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-5 py-3.5 shadow-sm">
        <span className="text-[13px] text-muted-foreground">
          {submitted
            ? score !== null && score >= 100
              ? "Great work — move on when ready."
              : `Score: ${score}%`
            : allAnswered
              ? "Ready to submit?"
              : "Answer all questions above, then submit."}
        </span>
        <div className="flex items-center gap-2">
          {submitted && nextLesson ? (
            <Button asChild size="sm">
              <Link href={`/app/lessons/${nextLesson.id}`}>
                {nextLesson.title} →
              </Link>
            </Button>
          ) : (
            <Button disabled={!allAnswered || submitted} onClick={submit} size="sm" type="button">
              Submit answers
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
