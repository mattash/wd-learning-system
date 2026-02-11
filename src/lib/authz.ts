import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { E2E_DEFAULT_ROLE, E2E_USER_ID } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ParishRole } from "@/lib/types";

const roleRank: Record<ParishRole, number> = {
  student: 1,
  instructor: 2,
  parish_admin: 3,
};

export async function requireAuth() {
  if (isE2ESmokeMode()) {
    return E2E_USER_ID;
  }

  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  return userId;
}

export async function hasCompletedOnboarding(clerkUserId: string) {
  if (isE2ESmokeMode()) {
    const store = await cookies();
    return store.get("e2e_onboarding_complete")?.value === "1";
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  return Boolean(data?.onboarding_completed_at);
}

export async function requireOnboardingComplete(clerkUserId?: string) {
  const userId = clerkUserId ?? (await requireAuth());
  const completed = await hasCompletedOnboarding(userId);
  if (!completed) {
    redirect("/app/onboarding");
  }
  return userId;
}

export async function requireActiveParish(clerkUserId?: string) {
  await requireOnboardingComplete(clerkUserId);
  const store = await cookies();
  const activeParishId = store.get("active_parish_id")?.value;
  if (!activeParishId) {
    redirect("/app/select-parish");
  }
  return activeParishId;
}

export async function requireParishRole(minRole: ParishRole) {
  const clerkUserId = await requireAuth();
  const parishId = await requireActiveParish(clerkUserId);

  if (isE2ESmokeMode()) {
    const store = await cookies();
    const roleCookie = store.get("e2e_role")?.value;
    const role: ParishRole =
      roleCookie === "parish_admin" || roleCookie === "instructor" || roleCookie === "student"
        ? roleCookie
        : E2E_DEFAULT_ROLE;

    if (roleRank[role] < roleRank[minRole]) {
      redirect("/app/courses");
    }

    return { clerkUserId, parishId, role };
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("parish_memberships")
    .select("role")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error || !data) {
    redirect("/app/select-parish");
  }

  if (roleRank[data.role as ParishRole] < roleRank[minRole]) {
    redirect("/app/courses");
  }

  return { clerkUserId, parishId, role: data.role as ParishRole };
}

export async function requireDioceseAdmin() {
  const clerkUserId = await requireAuth();

  if (isE2ESmokeMode()) {
    return clerkUserId;
  }

  const supabase = getSupabaseAdminClient();

  const { data } = await supabase
    .from("diocese_admins")
    .select("clerk_user_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (!data) {
    redirect("/app/courses");
  }

  return clerkUserId;
}

export async function getUserLabel(clerkUserId: string) {
  if (isE2ESmokeMode()) {
    return "E2E User";
  }

  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  return (
    user.fullName ??
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ??
    user.primaryEmailAddress?.emailAddress ??
    clerkUserId
  );
}
