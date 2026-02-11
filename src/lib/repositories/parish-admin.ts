import { E2E_COURSE } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { ParishRole } from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface ParishAdminOverview {
  memberCount: number;
  enrollmentCount: number;
  activeLearnerCount: number;
  stalledLearnerCount: number;
  completionRate: number;
}

export interface ParishAdminCourseRow {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  scope: "DIOCESE" | "PARISH";
}

export interface ParishAdminEnrollmentRow {
  id: string;
  clerk_user_id: string;
  course_id: string;
  cohort_id: string | null;
  created_at: string;
}

export interface ParishAdminMemberRow {
  clerk_user_id: string;
  role: ParishRole;
  email: string | null;
  display_name: string | null;
}

export interface ParishAdminCohortRow {
  id: string;
  name: string;
  facilitator_clerk_user_id: string | null;
  cadence: "weekly" | "biweekly" | "monthly" | "custom";
  next_session_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ParishMetricRow {
  learners_started: number;
  learners_completed: number;
}

export interface ParishAdminDashboardData {
  role: ParishRole;
  overview: ParishAdminOverview;
  visibleCourses: ParishAdminCourseRow[];
  dioceseCourses: ParishAdminCourseRow[];
  adoptedParishCourses: ParishAdminCourseRow[];
  availableParishCourses: ParishAdminCourseRow[];
  enrollments: ParishAdminEnrollmentRow[];
  members: ParishAdminMemberRow[];
  cohorts: ParishAdminCohortRow[];
  communicationSends: ParishAdminCommunicationSendRow[];
  participationRows: ParishAdminParticipationRow[];
}

export interface ParishAdminCommunicationSendRow {
  id: string;
  audience_type: "all_members" | "stalled_learners" | "cohort" | "course";
  audience_value: string | null;
  subject: string;
  body: string;
  recipient_count: number;
  delivery_status: "not_configured" | "queued" | "sent" | "failed";
  created_by_clerk_user_id: string;
  created_at: string;
}

export type ParishParticipationStatus = "not_started" | "active" | "stalled" | "completed";

export interface ParishAdminParticipationRow {
  enrollment_id: string;
  clerk_user_id: string;
  course_id: string;
  cohort_id: string | null;
  enrolled_at: string;
  completed_lessons: number;
  started_lessons: number;
  total_lessons: number;
  progress_percent: number;
  last_activity_at: string | null;
  status: ParishParticipationStatus;
}

function sortCoursesByTitle(courses: ParishAdminCourseRow[]) {
  return [...courses].sort((a, b) => a.title.localeCompare(b.title));
}

export async function getParishAdminDashboardData(parishId: string): Promise<ParishAdminDashboardData> {
  return getParishAdminDashboardDataForUser({
    parishId,
    role: "parish_admin",
    clerkUserId: "",
  });
}

export async function getParishAdminDashboardDataForUser({
  parishId,
  role,
  clerkUserId,
}: {
  parishId: string;
  role: ParishRole;
  clerkUserId: string;
}): Promise<ParishAdminDashboardData> {
  if (isE2ESmokeMode()) {
    const e2eCourses: ParishAdminCourseRow[] = [E2E_COURSE];
    return {
      role,
      overview: {
        memberCount: 1,
        enrollmentCount: 1,
        activeLearnerCount: 1,
        stalledLearnerCount: 0,
        completionRate: 0,
      },
      visibleCourses: e2eCourses,
      dioceseCourses: [],
      adoptedParishCourses: e2eCourses,
      availableParishCourses: [],
      enrollments: [
        {
          id: "e2e-enrollment",
          clerk_user_id: "e2e-user",
          course_id: E2E_COURSE.id,
          cohort_id: "e2e-cohort",
          created_at: new Date().toISOString(),
        },
      ],
      members: [
        {
          clerk_user_id: "e2e-user",
          role: "parish_admin",
          email: "e2e@example.test",
          display_name: "E2E User",
        },
      ],
      cohorts: [
        {
          id: "e2e-cohort",
          name: "Core Formation Cohort",
          facilitator_clerk_user_id: "e2e-user",
          cadence: "weekly",
          next_session_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      communicationSends: [],
      participationRows: [
        {
          enrollment_id: "e2e-enrollment",
          clerk_user_id: "e2e-user",
          course_id: E2E_COURSE.id,
          cohort_id: "e2e-cohort",
          enrolled_at: new Date().toISOString(),
          completed_lessons: 0,
          started_lessons: 0,
          total_lessons: 0,
          progress_percent: 0,
          last_activity_at: null,
          status: "not_started",
        },
      ],
    };
  }

  const supabase = getSupabaseAdminClient();
  const stalledCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

  let cohortsQuery = supabase
    .from("cohorts")
    .select("id,name,facilitator_clerk_user_id,cadence,next_session_at,created_at,updated_at")
    .eq("parish_id", parishId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (role === "instructor") {
    cohortsQuery = cohortsQuery.eq("facilitator_clerk_user_id", clerkUserId);
  }

  const [visibleCoursesResult, allParishCoursesResult, adoptedCourseRowsResult, cohortsResult, metricRowsResult] =
    await Promise.all([
      supabase.rpc("get_visible_courses", { p_parish_id: parishId }),
      supabase
        .from("courses")
        .select("id,title,description,published,scope")
        .eq("published", true)
        .eq("scope", "PARISH"),
      supabase.from("course_parishes").select("course_id").eq("parish_id", parishId),
      cohortsQuery,
      supabase.rpc("parish_course_metrics", { p_parish_id: parishId }),
    ]);

  if (visibleCoursesResult.error) throw visibleCoursesResult.error;
  if (allParishCoursesResult.error) throw allParishCoursesResult.error;
  if (adoptedCourseRowsResult.error) throw adoptedCourseRowsResult.error;
  if (cohortsResult.error) throw cohortsResult.error;
  if (metricRowsResult.error) throw metricRowsResult.error;

  const cohorts = ((cohortsResult.data ?? []) as ParishAdminCohortRow[]) ?? [];
  const scopedCohortIds = cohorts.map((cohort) => cohort.id);

  let enrollments: ParishAdminEnrollmentRow[] = [];
  if (role === "instructor" && scopedCohortIds.length === 0) {
    enrollments = [];
  } else {
    let enrollmentsQuery = supabase
      .from("enrollments")
      .select("id,clerk_user_id,course_id,cohort_id,created_at")
      .eq("parish_id", parishId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (role === "instructor") {
      enrollmentsQuery = enrollmentsQuery.in("cohort_id", scopedCohortIds);
    }

    const enrollmentsResult = await enrollmentsQuery;
    if (enrollmentsResult.error) throw enrollmentsResult.error;
    enrollments = ((enrollmentsResult.data ?? []) as ParishAdminEnrollmentRow[]) ?? [];
  }

  const scopedUserIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.clerk_user_id)));
  const cohortFacilitatorIds = cohorts
    .map((cohort) => cohort.facilitator_clerk_user_id)
    .filter((id): id is string => Boolean(id));
  const memberIds = Array.from(new Set([...scopedUserIds, ...cohortFacilitatorIds, clerkUserId]));

  let membershipsQuery = supabase.from("parish_memberships").select("clerk_user_id,role").eq("parish_id", parishId);
  if (role === "instructor") {
    membershipsQuery = membershipsQuery.in("clerk_user_id", memberIds);
  }

  const membershipsResult = await membershipsQuery;
  if (membershipsResult.error) throw membershipsResult.error;

  const membershipRows = ((membershipsResult.data ?? []) as Array<{ clerk_user_id: string; role: ParishRole }>) ?? [];

  let profileRows: Array<{ clerk_user_id: string; email: string | null; display_name: string | null }> = [];
  if (memberIds.length > 0) {
    const profilesResult = await supabase
      .from("user_profiles")
      .select("clerk_user_id,email,display_name")
      .in("clerk_user_id", memberIds);
    if (profilesResult.error) throw profilesResult.error;
    profileRows = (profilesResult.data ?? []) as Array<{
      clerk_user_id: string;
      email: string | null;
      display_name: string | null;
    }>;
  }

  const profileByUserId = new Map(profileRows.map((profile) => [profile.clerk_user_id, profile]));
  const members = membershipRows
    .map((row) => {
      const profile = profileByUserId.get(row.clerk_user_id);
      return {
        clerk_user_id: row.clerk_user_id,
        role: row.role,
        email: profile?.email ?? null,
        display_name: profile?.display_name ?? null,
      };
    })
    .sort((a, b) => {
      const aLabel = a.display_name ?? a.email ?? a.clerk_user_id;
      const bLabel = b.display_name ?? b.email ?? b.clerk_user_id;
      return aLabel.localeCompare(bLabel);
    });

  const visibleCourses = ((visibleCoursesResult.data ?? []) as ParishAdminCourseRow[]) ?? [];
  const visibleCourseIds = new Set(enrollments.map((enrollment) => enrollment.course_id));
  const scopedVisibleCourses =
    role === "instructor" ? visibleCourses.filter((course) => visibleCourseIds.has(course.id)) : visibleCourses;

  const dioceseCourses =
    role === "parish_admin"
      ? sortCoursesByTitle(visibleCourses.filter((course) => course.scope === "DIOCESE"))
      : [];
  const allParishCourses = ((allParishCoursesResult.data ?? []) as ParishAdminCourseRow[]) ?? [];
  const adoptedCourseIds = new Set(
    (((adoptedCourseRowsResult.data ?? []) as Array<{ course_id: string }>).map((row) => row.course_id)) ?? [],
  );
  const adoptedParishCourses =
    role === "parish_admin"
      ? sortCoursesByTitle(allParishCourses.filter((course) => adoptedCourseIds.has(course.id)))
      : [];
  const availableParishCourses =
    role === "parish_admin"
      ? sortCoursesByTitle(allParishCourses.filter((course) => !adoptedCourseIds.has(course.id)))
      : [];
  let participationRows: ParishAdminParticipationRow[] = [];

  if (enrollments.length > 0) {
    const courseIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.course_id)));
    const enrollmentUserIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.clerk_user_id)));
    const modulesResult = await supabase.from("modules").select("course_id,lessons(id)").in("course_id", courseIds);
    if (modulesResult.error) throw modulesResult.error;

    const modules = (modulesResult.data ?? []) as Array<{ course_id: string; lessons: Array<{ id: string }> | null }>;
    const lessonToCourseId = new Map<string, string>();
    const lessonCountByCourseId = new Map<string, number>();
    const lessonIds = new Set<string>();

    for (const moduleRow of modules) {
      const lessons = moduleRow.lessons ?? [];
      lessonCountByCourseId.set(moduleRow.course_id, (lessonCountByCourseId.get(moduleRow.course_id) ?? 0) + lessons.length);
      for (const lesson of lessons) {
        lessonToCourseId.set(lesson.id, moduleRow.course_id);
        lessonIds.add(lesson.id);
      }
    }

    const progressByUserAndCourse = new Map<
      string,
      { completedLessonIds: Set<string>; startedLessonIds: Set<string>; lastActivityAt: string | null }
    >();

    if (lessonIds.size > 0 && enrollmentUserIds.length > 0) {
      const progressResult = await supabase
        .from("video_progress")
        .select("clerk_user_id,lesson_id,completed,updated_at")
        .eq("parish_id", parishId)
        .in("clerk_user_id", enrollmentUserIds)
        .in("lesson_id", Array.from(lessonIds));
      if (progressResult.error) throw progressResult.error;

      const progressRows =
        (progressResult.data ?? []) as Array<{
          clerk_user_id: string;
          lesson_id: string;
          completed: boolean;
          updated_at: string;
        }>;

      for (const row of progressRows) {
        const courseId = lessonToCourseId.get(row.lesson_id);
        if (!courseId) continue;

        const key = `${row.clerk_user_id}:${courseId}`;
        const existing = progressByUserAndCourse.get(key) ?? {
          completedLessonIds: new Set<string>(),
          startedLessonIds: new Set<string>(),
          lastActivityAt: null,
        };

        existing.startedLessonIds.add(row.lesson_id);
        if (row.completed) {
          existing.completedLessonIds.add(row.lesson_id);
        }
        if (!existing.lastActivityAt || row.updated_at > existing.lastActivityAt) {
          existing.lastActivityAt = row.updated_at;
        }

        progressByUserAndCourse.set(key, existing);
      }
    }

    participationRows = enrollments
      .map((enrollment) => {
        const key = `${enrollment.clerk_user_id}:${enrollment.course_id}`;
        const progress = progressByUserAndCourse.get(key);
        const completedLessons = progress?.completedLessonIds.size ?? 0;
        const startedLessons = progress?.startedLessonIds.size ?? 0;
        const totalLessons = lessonCountByCourseId.get(enrollment.course_id) ?? 0;
        const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        const lastActivityAt = progress?.lastActivityAt ?? null;

        let status: ParishParticipationStatus = "not_started";
        if (totalLessons > 0 && completedLessons >= totalLessons) {
          status = "completed";
        } else if (startedLessons === 0) {
          status = "not_started";
        } else if (lastActivityAt && lastActivityAt < stalledCutoff) {
          status = "stalled";
        } else {
          status = "active";
        }

        return {
          enrollment_id: enrollment.id,
          clerk_user_id: enrollment.clerk_user_id,
          course_id: enrollment.course_id,
          cohort_id: enrollment.cohort_id,
          enrolled_at: enrollment.created_at,
          completed_lessons: completedLessons,
          started_lessons: startedLessons,
          total_lessons: totalLessons,
          progress_percent: progressPercent,
          last_activity_at: lastActivityAt,
          status,
        };
      })
      .sort((a, b) => {
        const statusOrder: Record<ParishParticipationStatus, number> = {
          stalled: 0,
          not_started: 1,
          active: 2,
          completed: 3,
        };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        const aLast = a.last_activity_at ?? "";
        const bLast = b.last_activity_at ?? "";
        if (aLast !== bLast) return aLast.localeCompare(bLast);
        return a.clerk_user_id.localeCompare(b.clerk_user_id);
      });
  }

  let activeLearnerCount = 0;
  let stalledLearnerCount = 0;
  let completionRate = 0;
  let communicationSends: ParishAdminCommunicationSendRow[] = [];

  if (role === "parish_admin") {
    const [activeLearnerRowsResult, stalledRowsResult, messageSendsResult] = await Promise.all([
      supabase.from("video_progress").select("clerk_user_id").eq("parish_id", parishId),
      supabase
        .from("video_progress")
        .select("clerk_user_id")
        .eq("parish_id", parishId)
        .eq("completed", false)
        .lt("updated_at", stalledCutoff),
      supabase
        .from("parish_message_sends")
        .select(
          "id,audience_type,audience_value,subject,body,recipient_count,delivery_status,created_by_clerk_user_id,created_at",
        )
        .eq("parish_id", parishId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (activeLearnerRowsResult.error) throw activeLearnerRowsResult.error;
    if (stalledRowsResult.error) throw stalledRowsResult.error;
    if (messageSendsResult.error) throw messageSendsResult.error;

    activeLearnerCount = new Set(
      ((((activeLearnerRowsResult.data ?? []) as Array<{ clerk_user_id: string }>).map((row) => row.clerk_user_id)) ??
        []),
    ).size;
    stalledLearnerCount = new Set(
      ((((stalledRowsResult.data ?? []) as Array<{ clerk_user_id: string }>).map((row) => row.clerk_user_id)) ?? []),
    ).size;

    const metricRows = ((metricRowsResult.data ?? []) as ParishMetricRow[]) ?? [];
    const learnersStarted = metricRows.reduce((sum, row) => sum + Number(row.learners_started ?? 0), 0);
    const learnersCompleted = metricRows.reduce((sum, row) => sum + Number(row.learners_completed ?? 0), 0);
    completionRate = learnersStarted > 0 ? Math.round((learnersCompleted / learnersStarted) * 100) : 0;
    communicationSends = ((messageSendsResult.data ?? []) as ParishAdminCommunicationSendRow[]) ?? [];
  } else if (scopedUserIds.length > 0) {
    const progressRowsResult = await supabase
      .from("video_progress")
      .select("clerk_user_id,completed,updated_at")
      .eq("parish_id", parishId)
      .in("clerk_user_id", scopedUserIds);
    if (progressRowsResult.error) throw progressRowsResult.error;

    const progressRows =
      ((progressRowsResult.data ?? []) as Array<{ clerk_user_id: string; completed: boolean; updated_at: string }>) ??
      [];
    const activeUserIds = new Set(progressRows.map((row) => row.clerk_user_id));
    const completedUserIds = new Set(progressRows.filter((row) => row.completed).map((row) => row.clerk_user_id));
    const stalledUserIds = new Set(
      progressRows
        .filter((row) => !row.completed && row.updated_at < stalledCutoff)
        .map((row) => row.clerk_user_id),
    );

    activeLearnerCount = activeUserIds.size;
    stalledLearnerCount = stalledUserIds.size;
    completionRate = activeUserIds.size > 0 ? Math.round((completedUserIds.size / activeUserIds.size) * 100) : 0;
  }


  return {
    role,
    overview: {
      memberCount: members.length,
      enrollmentCount: enrollments.length,
      activeLearnerCount,
      stalledLearnerCount,
      completionRate,
    },
    visibleCourses: sortCoursesByTitle(scopedVisibleCourses),
    dioceseCourses,
    adoptedParishCourses,
    availableParishCourses,
    enrollments,
    members,
    cohorts,
    communicationSends,
    participationRows,
  };
}
