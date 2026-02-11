import { NextResponse } from "next/server";

import { requireDioceseAdmin } from "@/lib/authz";
import { hasDateFilters, loadEngagementReportData, parseEngagementFilters } from "@/lib/reports/engagement-report";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  await requireDioceseAdmin();
  const url = new URL(req.url);
  const parsedFilters = parseEngagementFilters(url.searchParams);
  if (!parsedFilters.ok) {
    return NextResponse.json({ error: parsedFilters.error }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const result = await loadEngagementReportData(supabase, parsedFilters.filters);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (!result.data) {
    return NextResponse.json({ rows: [] });
  }

  if (hasDateFilters(parsedFilters.filters)) {
    return NextResponse.json({ rows: result.data.rows, trends: result.data.trends });
  }

  return NextResponse.json({ rows: result.data.rows });
}
