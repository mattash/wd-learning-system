import Link from "next/link";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DioceseAdminPage() {
  await requireDioceseAdmin();
  const supabase = getSupabaseAdminClient();
  const [{ data: courseMetrics }, { data: lessonMetrics }, { data: parishes }] =
    await Promise.all([
      supabase.rpc("diocese_course_metrics"),
      supabase.rpc("diocese_lesson_metrics"),
      supabase.from("parishes").select("id,name,slug"),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Diocese Admin Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Parishes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {((parishes ?? []) as Array<{ id: string; name: string; slug: string }>).map((parish) => (
              <li key={parish.id}>
                {parish.name} ({parish.slug})
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto text-xs">{JSON.stringify(courseMetrics ?? [], null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto text-xs">{JSON.stringify(lessonMetrics ?? [], null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Tool</CardTitle>
          <CardDescription>
            Use the dedicated membership tool to add diocese admins and parish memberships.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="text-sm" variant="link">
            <Link href="/app/admin/memberships">Open membership tool</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
