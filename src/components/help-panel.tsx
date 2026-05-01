"use client";

import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HelpTopic {
  title: string;
  body: string;
}

type PageHelp = Record<string, HelpTopic[]>;

const HELP_CONTENT: PageHelp = {
  "/app/dashboard": [
    {
      title: "Your Dashboard",
      body: "This is your learning home base. See your enrolled courses, track progress, and pick up where you left off.",
    },
    {
      title: "Course Progress",
      body: "The progress ring shows what percentage of the course you've completed. Complete all quizzes to finish a course and earn a certificate.",
    },
    {
      title: "Continue Learning",
      body: 'Click "Continue" on any course card to jump straight to your last lesson. The system remembers where you are.',
    },
  ],
  "/app/catalog": [
    {
      title: "Course Catalog",
      body: "Browse all available courses for your parish. Click any course to see its full description and lessons.",
    },
    {
      title: "Enrollment",
      body: "Some courses require approval from your parish administrator. Submit a request and you'll be notified when it's approved.",
    },
    {
      title: "Diocese Courses",
      body: "Courses marked with a diocese badge are available across multiple parishes and are managed by the diocese.",
    },
  ],
  "/app/courses": [
    {
      title: "Your Courses",
      body: "These are courses you're enrolled in. Click any course to see its full content and lessons.",
    },
    {
      title: "Progress Tracking",
      body: "The progress bar shows how many lessons you've completed in each course. Finish all lessons to unlock your certificate.",
    },
  ],
  "/app/lessons": [
    {
      title: "Watching Lessons",
      body: "Video lessons play directly in the page. Your progress is saved automatically as you watch.",
    },
    {
      title: "Quizzes",
      body: "After certain lessons, you'll find a quiz. Answer all questions and submit to check your understanding.",
    },
    {
      title: "Earning Certificates",
      body: "Complete all lessons and pass all quizzes in a course to receive your course certificate. Find it under Certificates in the menu.",
    },
    {
      title: "Sidebar",
      body: "Use the sidebar on the left to navigate between modules and lessons. On mobile, tap the menu button.",
    },
  ],
  "/app/certificates": [
    {
      title: "Your Certificates",
      body: "Certificates are issued automatically when you complete all lessons in a course. Download or print them anytime.",
    },
    {
      title: "What counts as complete?",
      body: "A lesson is complete when you've watched the full video (or opened the document) and passed its quiz with 100%.",
    },
  ],
  "/app/profile": [
    {
      title: "Your Profile",
      body: "Manage your display name and notification preferences here. Contact your parish admin to change your email or parish.",
    },
  ],
};

const DEFAULT_HELP: HelpTopic[] = [
  {
    title: "Getting Help",
    body: "If you need help with something not covered here, contact your parish administrator.",
  },
];

export function HelpPanel() {
  const pathname = usePathname();

  // Match the most specific path (handles /app/lessons/[id] → /app/lessons)
  const topics =
    HELP_CONTENT[pathname] ??
    HELP_CONTENT[
      Object.keys(HELP_CONTENT).find((key) => key !== "/app/lessons" && pathname.startsWith(key)) ?? ""
    ] ??
    (pathname.startsWith("/app/lessons/") ? HELP_CONTENT["/app/lessons"] : DEFAULT_HELP);

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="fixed bottom-6 right-[4.5rem] z-40 gap-2 shadow-md md:right-6"
          type="button"
        >
          <span>?</span>
          <span className="hidden sm:inline">Help</span>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-full flex-col bg-card shadow-lg duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="font-display text-base font-bold leading-tight">
                How do I...?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                Tips for this page
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {topics.map((topic, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <p className="mb-1.5 font-medium text-sm">{topic.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{topic.body}</p>
              </div>
            ))}

            <div className="rounded-lg border border-border bg-surface-raised p-4">
              <p className="mb-1.5 font-medium text-sm">Need more help?</p>
              <p className="text-sm text-muted-foreground">
                Contact your parish administrator or email{" "}
                <a
                  className="text-primary underline"
                  href="mailto:stjohnarmenianchurch@gmail.com"
                >
                  stjohnarmenianchurch@gmail.com
                </a>
              </p>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}