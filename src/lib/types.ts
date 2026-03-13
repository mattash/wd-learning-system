export type ParishRole = "parish_admin" | "instructor" | "student";

export type CourseScope = "DIOCESE" | "PARISH";
export type LessonContentType = "VIDEO" | "DOCUMENT";

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
  descriptor: string | null;
  thumbnail_url: string | null;
  content_type: LessonContentType;
  youtube_video_id: string | null;
  document_url: string | null;
  document_page_start: number | null;
  document_page_end: number | null;
  passing_score: number;
  module_id: string;
}
