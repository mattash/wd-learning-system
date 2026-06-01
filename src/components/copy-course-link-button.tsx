"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CopyCourseLinkButton({
  courseId,
  published,
}: {
  courseId: string;
  published: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [clipboardAvailable, setClipboardAvailable] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const courseUrl = `${window.location.origin}/courses/${courseId}`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(courseUrl);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setClipboardAvailable(false);
    }
  }, [courseUrl]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Unpublished: show disabled button with tooltip
  if (!published) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                aria-label="Share link"
                disabled
                size="xs"
                type="button"
                variant="ghost"
              >
                <LinkIcon className="size-3.5" />
                Share link
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Publish course to get a shareable link
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Clipboard not available: show readonly input
  if (!clipboardAvailable) {
    return (
      <Input
        aria-label="Course link"
        className="w-[220px]"
        readOnly
        size={2}
        value={courseUrl}
      />
    );
  }

  // Published + clipboard available
  return (
    <Button
      aria-label={copied ? "Copied" : "Copy course link"}
      onClick={copy}
      size="xs"
      type="button"
      variant={copied ? "default" : "ghost"}
    >
      {copied ? (
        <>
          <Check className="size-3.5" />
          Copied!
        </>
      ) : (
        <>
          <LinkIcon className="size-3.5" />
          Share link
        </>
      )}
    </Button>
  );
}
