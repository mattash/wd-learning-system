import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function ParishAdminPage() {
  const { parishId } = await requireParishRole("parish_admin");
  const supabase = getSupabaseAdminClient();
  const [{ data: courses }, { data: metrics }] = await Promise.all([
    supabase.rpc("get_visible_courses", { p_parish_id: parishId }),
    supabase.rpc("parish_course_metrics", { p_parish_id: parishId }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Parish Admin Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Visible Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {((courses ?? []) as Array<{ id: string; title: string }>).map((course) => (
              <li key={course.id}>
                <Button asChild className="h-auto p-0 font-medium" variant="link">
                  <Link href={`/app/courses/${course.id}`}>{course.title}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Parish Course Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto text-xs">{JSON.stringify(metrics ?? [], null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
