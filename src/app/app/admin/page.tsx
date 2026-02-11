import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

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

      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Parishes</h2>
        <ul className="space-y-1 text-sm">
          {((parishes ?? []) as Array<{ id: string; name: string; slug: string }>).map((parish) => (
            <li key={parish.id}>
              {parish.name} ({parish.slug})
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Course Analytics</h2>
        <pre className="overflow-auto text-xs">{JSON.stringify(courseMetrics ?? [], null, 2)}</pre>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Lesson Analytics</h2>
        <pre className="overflow-auto text-xs">{JSON.stringify(lessonMetrics ?? [], null, 2)}</pre>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Admin Tool</h2>
        <p className="text-sm text-slate-600">Use the dedicated membership tool to add diocese admins and parish memberships.</p>
      <a className="text-blue-700 underline text-sm" href="/app/admin/memberships">Open membership tool</a>
      </section>
    </div>
  );
}
