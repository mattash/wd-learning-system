import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ParishRole } from "@/lib/types";

const roleRank: Record<ParishRole, number> = {
  student: 1,
  instructor: 2,
  parish_admin: 3,
};

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  return userId;
}

export async function requireActiveParish() {
  const store = await cookies();
  const activeParishId = store.get("active_parish_id")?.value;
  if (!activeParishId) {
    redirect("/app/select-parish");
  }
  return activeParishId;
}

export async function requireParishRole(minRole: ParishRole) {
  const clerkUserId = await requireAuth();
  const parishId = await requireActiveParish();
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
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  return (
    user.fullName ??
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ??
    user.primaryEmailAddress?.emailAddress ??
    clerkUserId
  );
}
