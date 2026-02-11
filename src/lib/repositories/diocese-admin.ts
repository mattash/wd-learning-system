import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface DioceseOverview {
  parishCount: number;
  userCount: number;
  dioceseAdminCount: number;
  courseCount: number;
  publishedCourseCount: number;
  enrollmentCount: number;
  progressRecordCount: number;
  completedProgressRecordCount: number;
}

export interface DioceseUserRow {
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface DioceseParishRow {
  id: string;
  name: string;
  slug: string;
  allow_self_signup: boolean;
  created_at: string;
}

export interface DioceseCourseRow {
  id: string;
  title: string;
  description: string | null;
  scope: "DIOCESE" | "PARISH";
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DioceseEngagementRow {
  parish_id: string;
  course_id: string;
  learners_started: number;
  learners_completed: number;
}


export interface DioceseQuestionRow {
  id: string;
  lesson_id: string;
  prompt: string;
  options: string[];
  correct_option_index: number;
  sort_order: number;
}

export interface DioceseLessonRow {
  id: string;
  module_id: string;
  title: string;
  youtube_video_id: string;
  sort_order: number;
  passing_score: number;
  questions: DioceseQuestionRow[];
}

export interface DioceseModuleRow {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  lessons: DioceseLessonRow[];
}

export interface DioceseEnrollmentRow {
  id: string;
  parish_id: string;
  clerk_user_id: string;
  course_id: string;
  created_at: string;
}

async function getTableCount(table: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function getProgressRecordCount(completedOnly: boolean) {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("video_progress").select("id", { count: "exact", head: true });

  if (completedOnly) {
    query = query.eq("completed", true);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count ?? 0;
}

export async function getDioceseOverview(): Promise<DioceseOverview> {
  const supabase = getSupabaseAdminClient();

  const [
    parishCount,
    userCount,
    dioceseAdminCount,
    courseCount,
    enrollmentCount,
    progressRecordCount,
    completedProgressRecordCount,
    publishedCoursesResult,
  ] = await Promise.all([
    getTableCount("parishes"),
    getTableCount("user_profiles"),
    supabase.from("diocese_admins").select("clerk_user_id", { count: "exact", head: true }),
    getTableCount("courses"),
    getTableCount("enrollments"),
    getProgressRecordCount(false),
    getProgressRecordCount(true),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("published", true),
  ]);

  if (dioceseAdminCount.error) throw dioceseAdminCount.error;
  if (publishedCoursesResult.error) throw publishedCoursesResult.error;

  return {
    parishCount,
    userCount,
    dioceseAdminCount: dioceseAdminCount.count ?? 0,
    courseCount,
    publishedCourseCount: publishedCoursesResult.count ?? 0,
    enrollmentCount,
    progressRecordCount,
    completedProgressRecordCount,
  };
}

export async function listDioceseUsers(limit = 25): Promise<DioceseUserRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("clerk_user_id,email,display_name,onboarding_completed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as DioceseUserRow[]) ?? [];
}

export async function listParishes(limit = 25): Promise<DioceseParishRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parishes")
    .select("id,name,slug,allow_self_signup,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as DioceseParishRow[]) ?? [];
}

export async function listCourses(limit = 25): Promise<DioceseCourseRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id,title,description,scope,published,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as DioceseCourseRow[]) ?? [];
}

export async function listEngagement(limit = 50): Promise<DioceseEngagementRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc("diocese_course_metrics")
    .order("learners_started", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as DioceseEngagementRow[]) ?? [];
}

export async function listEnrollments(limit = 100): Promise<DioceseEnrollmentRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id,parish_id,clerk_user_id,course_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as DioceseEnrollmentRow[]) ?? [];
}

export async function getCourseContentForAdmin(courseId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,title,description,scope,published,created_at,updated_at")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) return null;

  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select(
      "id,course_id,title,sort_order, lessons(id,module_id,title,youtube_video_id,sort_order,passing_score, questions(id,lesson_id,prompt,options,correct_option_index,sort_order))",
    )
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (modulesError) throw modulesError;

  return {
    course: course as DioceseCourseRow,
    modules: ((modules ?? []) as DioceseModuleRow[]) ?? [],
  };
}
