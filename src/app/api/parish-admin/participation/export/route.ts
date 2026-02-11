import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import type {
  ParishAdminCourseRow,
  ParishAdminCohortRow,
  ParishAdminMemberRow,
  ParishAdminParticipationRow,
  ParishParticipationStatus,
} from "@/lib/repositories/parish-admin";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

const querySchema = z.object({
  courseId: z.string().uuid().optional(),
  cohortId: z.union([z.string().uuid(), z.literal("unassigned")]).optional(),
  status: z.enum(["not_started", "active", "stalled", "completed"]).optional(),
  search: z.string().trim().max(120).optional(),
});

const statusLabels: Record<ParishParticipationStatus, string> = {
  not_started: "Not started",
  active: "Active",
  stalled: "Stalled",
  completed: "Completed",
};

function toLearnerLabel(member: ParishAdminMemberRow | undefined, clerkUserId: string) {
  return member?.display_name ?? member?.email ?? clerkUserId;
}

function filterRows({
  rows,
  members,
  courses,
  cohorts,
  filters,
}: {
  rows: ParishAdminParticipationRow[];
  members: ParishAdminMemberRow[];
  courses: ParishAdminCourseRow[];
  cohorts: ParishAdminCohortRow[];
  filters: z.infer<typeof querySchema>;
}) {
  const memberById = new Map(members.map((member) => [member.clerk_user_id, member]));
  const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));
  const cohortNameById = new Map(cohorts.map((cohort) => [cohort.id, cohort.name]));
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";

  return rows.filter((row) => {
    if (filters.courseId && row.course_id !== filters.courseId) return false;
    if (filters.cohortId === "unassigned" && row.cohort_id) return false;
    if (filters.cohortId && filters.cohortId !== "unassigned" && row.cohort_id !== filters.cohortId) return false;
    if (filters.status && row.status !== filters.status) return false;

    if (!normalizedSearch) return true;
    const learnerLabel = toLearnerLabel(memberById.get(row.clerk_user_id), row.clerk_user_id).toLowerCase();
    const courseTitle = (courseTitleById.get(row.course_id) ?? row.course_id).toLowerCase();
    const cohortName = (row.cohort_id ? cohortNameById.get(row.cohort_id) ?? row.cohort_id : "unassigned").toLowerCase();
    const clerkUserId = row.clerk_user_id.toLowerCase();

    return (
      learnerLabel.includes(normalizedSearch) ||
      courseTitle.includes(normalizedSearch) ||
      cohortName.includes(normalizedSearch) ||
      clerkUserId.includes(normalizedSearch)
    );
  });
}

function csvValue(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    courseId: url.searchParams.get("courseId") ?? undefined,
    cohortId: url.searchParams.get("cohortId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid participation export filters." }, { status: 400 });
  }

  const data = await getParishAdminDashboardDataForUser({
    parishId,
    role,
    clerkUserId,
  });
  const memberById = new Map(data.members.map((member) => [member.clerk_user_id, member]));
  const courseTitleById = new Map(data.visibleCourses.map((course) => [course.id, course.title]));
  const cohortNameById = new Map(data.cohorts.map((cohort) => [cohort.id, cohort.name]));
  const rows = filterRows({
    rows: data.participationRows,
    members: data.members,
    courses: data.visibleCourses,
    cohorts: data.cohorts,
    filters: parsed.data,
  });

  const headers = [
    "learner_name",
    "learner_email",
    "clerk_user_id",
    "course",
    "cohort",
    "status",
    "progress_percent",
    "completed_lessons",
    "total_lessons",
    "last_activity_at",
    "enrolled_at",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        toLearnerLabel(memberById.get(row.clerk_user_id), row.clerk_user_id),
        memberById.get(row.clerk_user_id)?.email ?? "",
        row.clerk_user_id,
        courseTitleById.get(row.course_id) ?? row.course_id,
        row.cohort_id ? cohortNameById.get(row.cohort_id) ?? row.cohort_id : "Unassigned",
        statusLabels[row.status],
        row.progress_percent,
        row.completed_lessons,
        row.total_lessons,
        row.last_activity_at ?? "",
        row.enrolled_at,
      ]
        .map(csvValue)
        .join(","),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="parish-participation.csv"',
    },
  });
}
