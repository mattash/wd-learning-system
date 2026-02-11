"use client";

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
}: {
  lessonId: string;
  parishId: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);

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
    }
  };

  return (
    <div className="space-y-4 rounded border bg-white p-4">
      <h2 className="text-lg font-semibold">Quiz</h2>
      {questions.map((q) => (
        <div className="space-y-2" key={q.id}>
          <p className="font-medium">{q.prompt}</p>
          {q.options.map((option, idx) => (
            <label className="flex items-center gap-2 text-sm" key={option}>
              <input
                checked={answers[q.id] === idx}
                name={q.id}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                type="radio"
              />
              {option}
            </label>
          ))}
        </div>
      ))}
      <Button onClick={submit} type="button">
        Submit Quiz
      </Button>
      {score !== null && <p className="text-sm">Latest score: {score}%</p>}
    </div>
  );
}
