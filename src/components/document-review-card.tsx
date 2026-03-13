"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DocumentReviewCard({
  lessonId,
  parishId,
  documentUrl,
  documentLabel,
  initiallyCompleted,
}: {
  lessonId: string;
  parishId: string;
  documentUrl: string;
  documentLabel: string;
  initiallyCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function markReviewed() {
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId,
        parishId,
        percentWatched: 100,
        lastPositionSeconds: 0,
        completed: true,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setCompleted(true);
      setMessage("Section marked as reviewed.");
    } else {
      setMessage(data.error ?? "Unable to update review status.");
    }

    setSubmitting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document review</CardTitle>
        <CardDescription>Open the assigned section, review it, then mark the section as complete.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <a href={documentUrl} rel="noreferrer" target="_blank">
              Open {documentLabel}
            </a>
          </Button>
          <Button disabled={completed || submitting} onClick={markReviewed} type="button">
            {completed ? "Section reviewed" : submitting ? "Saving..." : "Mark section reviewed"}
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
