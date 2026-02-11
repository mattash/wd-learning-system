import Link from "next/link";

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
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Visible Courses</h2>
        <ul className="space-y-1">
          {((courses ?? []) as Array<{ id: string; title: string }>).map((course) => (
            <li key={course.id}>
              <Link className="text-blue-700 underline" href={`/app/courses/${course.id}`}>
                {course.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Parish Course Analytics</h2>
        <pre className="overflow-auto text-xs">{JSON.stringify(metrics ?? [], null, 2)}</pre>
      </section>
    </div>
  );
}
