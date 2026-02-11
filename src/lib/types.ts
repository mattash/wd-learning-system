export type ParishRole = "parish_admin" | "instructor" | "student";

export type CourseScope = "DIOCESE" | "PARISH";

export interface Parish {
  id: string;
  name: string;
  slug: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  scope: CourseScope;
}

export interface Lesson {
  id: string;
  title: string;
  youtube_video_id: string;
  passing_score: number;
  module_id: string;
}
