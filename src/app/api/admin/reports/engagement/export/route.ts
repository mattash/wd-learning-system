import { requireDioceseAdmin } from "@/lib/authz";
import { loadEngagementReportData, parseEngagementFilters } from "@/lib/reports/engagement-report";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  await requireDioceseAdmin();
  const url = new URL(req.url);
  const parsedFilters = parseEngagementFilters(url.searchParams);
  if (!parsedFilters.ok) {
    return Response.json({ error: parsedFilters.error }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const result = await loadEngagementReportData(supabase, parsedFilters.filters);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const rows = (result.data?.rows ?? []).map((row) => ({
    parish: row.parish_name,
    course: row.course_title,
    enrollment_count: row.enrollment_count,
    learners_started: row.learners_started,
    learners_completed: row.learners_completed,
    completion_rate: row.completion_rate,
  }));

  const headers = [
    "parish",
    "course",
    "enrollment_count",
    "learners_started",
    "learners_completed",
    "completion_rate",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.parish,
        row.course,
        row.enrollment_count,
        row.learners_started,
        row.learners_completed,
        row.completion_rate,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="engagement-report.csv"',
    },
  });
}
