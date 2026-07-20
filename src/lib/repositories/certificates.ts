import { E2E_COURSE } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { isLessonComplete } from "@/lib/grading";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { CertificateData } from "@/lib/certificates/certificate-pdf";

export interface CertificateRecord {
  id: string;
  clerk_user_id: string;
  parish_id: string;
  course_id: string;
  issued_at: string;
  download_url: string | null;
}

export interface CertificateWithDetails extends CertificateRecord {
  course_title: string;
  parish_name: string;
  student_name: string;
  completion_date: string;
  lesson_count: number;
}

async function getParishName(parishId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("parishes")
    .select("name")
    .eq("id", parishId)
    .single();
  return (data as { name: string } | null)?.name ?? "Unknown Parish";
}

async function getStudentName(clerkUserId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return (data as { display_name: string } | null)?.display_name ?? clerkUserId;
}

export async function checkAndIssueCertificate({
  clerkUserId,
  parishId,
  courseId,
}: {
  clerkUserId: string;
  parishId: string;
  courseId: string;
}): Promise<{ certificate: CertificateRecord; newlyIssued: boolean } | null> {
  if (isE2ESmokeMode()) return null;

  const supabase = getSupabaseAdminClient();

  // Check if certificate already exists
  const { data: existing } = await supabase
    .from("certificates")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .eq("parish_id", parishId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return { certificate: existing as CertificateRecord, newlyIssued: false };

  // Verify all lessons in course are completed
  const { data: modules } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId);

  const moduleIds = ((modules ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (moduleIds.length === 0) return null;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, passing_score, questions(id)")
    .in("module_id", moduleIds);

  const lessonRows = (lessons ?? []) as Array<{
    id: string;
    passing_score: number;
    questions: Array<{ id: string }> | null;
  }>;
  const lessonIds = lessonRows.map((lesson) => lesson.id);
  if (lessonIds.length === 0) return null;

  const { data: progressRows } = await supabase
    .from("video_progress")
    .select("lesson_id, completed")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .in("lesson_id", lessonIds);

  const contentCompletedByLesson = new Map(
    ((progressRows ?? []) as Array<{ lesson_id: string; completed: boolean }>).map(
      (progress) => [progress.lesson_id, progress.completed],
    ),
  );

  const { data: quizRows } = await supabase
    .from("quiz_attempts")
    .select("lesson_id, score")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .in("lesson_id", lessonIds);

  const bestScoreByLesson = new Map<string, number>();
  for (const attempt of (quizRows ?? []) as Array<{
    lesson_id: string;
    score: number;
  }>) {
    const current = bestScoreByLesson.get(attempt.lesson_id) ?? 0;
    if (attempt.score > current) {
      bestScoreByLesson.set(attempt.lesson_id, attempt.score);
    }
  }

  const allDone = lessonRows.every((lesson) =>
    isLessonComplete({
      contentCompleted: contentCompletedByLesson.get(lesson.id) ?? false,
      bestScore: bestScoreByLesson.get(lesson.id) ?? 0,
      passingScore: lesson.passing_score,
      questionCount: lesson.questions?.length ?? 0,
    }),
  );

  if (!allDone) return null;

  // All lessons complete — issue certificate
  const { data: cert, error } = await supabase
    .from("certificates")
    .insert({
      clerk_user_id: clerkUserId,
      parish_id: parishId,
      course_id: courseId,
      download_url: null, // URL set when PDF is generated
    })
    .select("id, clerk_user_id, parish_id, course_id, issued_at, download_url")
    .single();

  if (error) return null;
  return { certificate: cert as CertificateRecord, newlyIssued: true };
}

export async function listStudentCertificates(
  clerkUserId: string,
  parishId: string,
): Promise<CertificateWithDetails[]> {
  if (isE2ESmokeMode()) return [];

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("id, clerk_user_id, parish_id, course_id, issued_at, download_url")
    .eq("clerk_user_id", clerkUserId)
    .eq("parish_id", parishId)
    .order("issued_at", { ascending: false });

  if (error || !data) return [];

  const certs = data as CertificateRecord[];

  // Enrich with course title and parish name
  const courseIds = [...new Set(certs.map((c) => c.course_id))];
  const { data: courseRows } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", courseIds);
  const courseMap = new Map(
    ((courseRows ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]),
  );

  const parishName = await getParishName(parishId);
  const studentName = await getStudentName(clerkUserId);

  // Get lesson counts
  const { data: allModules } = await supabase
    .from("modules")
    .select("id, course_id")
    .in("course_id", courseIds);
  const modulesByCourse = new Map<string, string[]>();
  for (const m of (allModules ?? []) as Array<{ id: string; course_id: string }>) {
    if (!modulesByCourse.has(m.course_id)) modulesByCourse.set(m.course_id, []);
    modulesByCourse.get(m.course_id)!.push(m.id);
  }
  const { data: allLessons } = await supabase
    .from("lessons")
    .select("id, module_id")
    .in("module_id", [...new Set(((allModules ?? []) as Array<{ id: string }>).map((m) => m.id))]);
  const lessonCountByCourse = new Map<string, number>();
  for (const [cid, mids] of modulesByCourse) {
    const mLessons = ((allLessons ?? []) as Array<{ module_id: string }>).filter((l) => mids.includes(l.module_id));
    lessonCountByCourse.set(cid, mLessons.length);
  }

  return certs.map((cert) => ({
    ...cert,
    course_title: courseMap.get(cert.course_id) ?? "Unknown Course",
    parish_name: parishName,
    student_name: studentName,
    completion_date: new Date(cert.issued_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    lesson_count: lessonCountByCourse.get(cert.course_id) ?? 0,
  }));
}

export async function getCertificatePdfData(
  certId: string,
): Promise<CertificateData | null> {
  if (isE2ESmokeMode()) return null;

  const supabase = getSupabaseAdminClient();
  const { data: cert } = await supabase
    .from("certificates")
    .select("clerk_user_id, parish_id, course_id, issued_at")
    .eq("id", certId)
    .single();

  if (!cert) return null;
  const c = cert as { clerk_user_id: string; parish_id: string; course_id: string; issued_at: string };

  const [parishName, studentName, courseRow] = await Promise.all([
    getParishName(c.parish_id),
    getStudentName(c.clerk_user_id),
    supabase.from("courses").select("title").eq("id", c.course_id).single(),
  ]);

  const courseTitle = (courseRow.data as { title: string } | null)?.title ?? "Unknown Course";
  const completionDate = new Date(c.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    studentName,
    courseTitle,
    parishName,
    completionDate,
    courseLessonCount: 0, // filled by caller or enriched via lesson count
  };
}
