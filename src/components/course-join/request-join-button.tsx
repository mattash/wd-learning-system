"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface RequestJoinButtonProps {
  courseId: string;
}

export function RequestJoinButton({ courseId }: RequestJoinButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (requested) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-success">Request sent</p>
        <p className="text-xs text-muted-foreground">
          Your parish admin will review it soon.
        </p>
      </div>
    );
  }

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/student/course-join-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to send request");
          return;
        }
        setRequested(true);
        router.refresh();
      } catch {
        setError("Network error — please try again");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        variant="default"
        size="sm"
        onClick={handleRequest}
        disabled={isPending}
      >
        {isPending ? "Sending..." : "Request to Join"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
