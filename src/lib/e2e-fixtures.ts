import type { ParishRole } from "@/lib/types";

export const E2E_USER_ID = "e2e-user";
export const E2E_DEFAULT_ROLE: ParishRole = "student";

export const E2E_PARISHES = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Saint Mark Parish",
    slug: "saint-mark",
  },
  {
    id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    name: "Holy Cross Parish",
    slug: "holy-cross",
  },
] as const;

export const E2E_COURSE = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Foundations of Parish Leadership",
  description: "Core formation for mission, service, and pastoral leadership.",
  published: true,
  scope: "PARISH" as const,
};

export const E2E_MODULE = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Orientation",
  sort_order: 1,
};

export const E2E_LESSON = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Welcome Lesson",
  youtube_video_id: "dQw4w9WgXcQ",
  passing_score: 80,
  module_id: E2E_MODULE.id,
};

export const E2E_QUESTIONS = [
  {
    id: "55555555-5555-4555-8555-555555555555",
    prompt: "Primary source for Christian teaching?",
    options: ["Myth", "Scripture", "Rumor"],
    correct_option_index: 1,
    sort_order: 1,
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    prompt: "Best posture for parish leadership?",
    options: ["Serve and learn", "Control and isolate", "Avoid responsibility"],
    correct_option_index: 0,
    sort_order: 2,
  },
] as const;
