"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "@/components/ui/radio";

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
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quiz</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q) => (
          <div className="space-y-2" key={q.id}>
            <p className="font-medium">{q.prompt}</p>
            {q.options.map((option, idx) => (
              <label className="flex items-center gap-2 text-sm" key={option}>
                <Radio
                  checked={answers[q.id] === idx}
                  disabled={submitted}
                  name={q.id}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                />
                {option}
              </label>
            ))}
          </div>
        ))}
        {!submitted && (
          <Button disabled={!allAnswered} onClick={submit} type="button">
            Submit Quiz
          </Button>
        )}
        {score !== null && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Score: {score}%</p>
            {nextLesson && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/lessons/${nextLesson.id}`}>
                  Next: {nextLesson.title} →
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
