"use client";

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
                  name={q.id}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                />
                {option}
              </label>
            ))}
          </div>
        ))}
        <Button onClick={submit} type="button">
          Submit Quiz
        </Button>
        {score !== null && <p className="text-sm text-muted-foreground">Latest score: {score}%</p>}
      </CardContent>
    </Card>
  );
}
