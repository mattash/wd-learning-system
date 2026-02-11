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

function parseParishRole(value: string | undefined): ParishRole | null {
  if (value === "parish_admin" || value === "instructor" || value === "student") {
    return value;
  }
  return null;
}

function hasRoleAtLeast(role: ParishRole, minRole: ParishRole) {
  return roleRank[role] >= roleRank[minRole];
}

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
    const role = parseParishRole(store.get("e2e_role")?.value) ?? E2E_DEFAULT_ROLE;

    if (!hasRoleAtLeast(role, minRole)) {
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

  const role = data.role as ParishRole;
  if (!hasRoleAtLeast(role, minRole)) {
    redirect("/app/courses");
  }

  return { clerkUserId, parishId, role };
}

export async function getActiveParishRole(clerkUserId?: string): Promise<ParishRole | null> {
  const userId = clerkUserId ?? (await requireAuth());
  const store = await cookies();

  if (isE2ESmokeMode()) {
    return parseParishRole(store.get("e2e_role")?.value) ?? E2E_DEFAULT_ROLE;
  }

  const activeParishId = store.get("active_parish_id")?.value;
  if (!activeParishId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parish_memberships")
    .select("role")
    .eq("parish_id", activeParishId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role as ParishRole;
}

export async function hasActiveParishRole(minRole: ParishRole, clerkUserId?: string) {
  const role = await getActiveParishRole(clerkUserId);
  if (!role) {
    return false;
  }
  return hasRoleAtLeast(role, minRole);
}

export async function requireDioceseAdmin() {
  const clerkUserId = await requireAuth();

  const isAdmin = await isDioceseAdmin(clerkUserId);

  if (!isAdmin) {
    redirect("/app/courses");
  }

  return clerkUserId;
}

export async function isDioceseAdmin(clerkUserId?: string) {
  const userId = clerkUserId ?? (await requireAuth());

  if (isE2ESmokeMode()) {
    return true;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("diocese_admins")
    .select("clerk_user_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
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
