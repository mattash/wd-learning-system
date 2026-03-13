import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getActiveParishRole, hasCompletedOnboarding, isDioceseAdmin, requireAuth } from "@/lib/authz";
import { E2E_PARISHES } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AppIndex() {
  const userId = await requireAuth();

  if (!(await hasCompletedOnboarding(userId))) {
    redirect("/app/onboarding");
  }

  if (await isDioceseAdmin(userId)) {
    redirect("/app/admin");
  }

  const store = await cookies();
  const activeParishId = store.get("active_parish_id")?.value;

  if (isE2ESmokeMode()) {
    const resolvedParishId = activeParishId ?? E2E_PARISHES[0]?.id;
    if (!resolvedParishId) {
      redirect("/app/select-parish");
    }

    const role = await getActiveParishRole(userId);
    if (role === "parish_admin" || role === "instructor") {
      redirect("/app/parish-admin");
    }

    redirect("/app/courses");
  }

  const supabase = getSupabaseAdminClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from("parish_memberships")
    .select("parish_id,role")
    .eq("clerk_user_id", userId);

  if (membershipsError) {
    redirect("/app/select-parish");
  }

  const membershipRows =
    ((memberships ?? []) as Array<{ parish_id: string; role: "parish_admin" | "instructor" | "student" }>) ?? [];

  if (membershipRows.length === 0) {
    redirect("/app/select-parish");
  }

  const membershipByParishId = new Map(membershipRows.map((row) => [row.parish_id, row.role]));
  const resolvedParishId =
    activeParishId && membershipByParishId.has(activeParishId)
      ? activeParishId
      : membershipRows.length === 1
        ? membershipRows[0].parish_id
        : null;

  if (!resolvedParishId) {
    redirect("/app/select-parish?manage=1");
  }

  if (resolvedParishId !== activeParishId) {
    const params = new URLSearchParams({ parishId: resolvedParishId });
    redirect(`/app/select-parish/activate?${params.toString()}`);
  }

  const role = membershipByParishId.get(resolvedParishId);
  if (role === "parish_admin" || role === "instructor") {
    redirect("/app/parish-admin");
  }

  redirect("/app/courses");
}
