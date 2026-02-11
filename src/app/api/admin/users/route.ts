import { NextResponse } from "next/server";
import { z } from "zod";

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  onboarding: z.enum(["all", "yes", "no"]).default("all"),
  parishId: z.string().uuid().optional(),
  role: z.enum(["all", "parish_admin", "instructor", "student"]).default("all"),
  dioceseAdmin: z.enum(["all", "yes", "no"]).default("all"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

interface UserProfileRow {
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

interface ParishMembershipRow {
  parish_id: string;
  clerk_user_id: string;
  role: "parish_admin" | "instructor" | "student";
}

interface ParishRow {
  id: string;
  name: string;
}

interface DioceseAdminRow {
  clerk_user_id: string;
}

export async function GET(req: Request) {
  await requireDioceseAdmin();

  const parsedQuery = querySchema.safeParse({
    q: new URL(req.url).searchParams.get("q") ?? undefined,
    onboarding: new URL(req.url).searchParams.get("onboarding") ?? undefined,
    parishId: new URL(req.url).searchParams.get("parishId") ?? undefined,
    role: new URL(req.url).searchParams.get("role") ?? undefined,
    dioceseAdmin: new URL(req.url).searchParams.get("dioceseAdmin") ?? undefined,
    limit: new URL(req.url).searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Invalid query params" }, { status: 400 });
  }

  const { q, onboarding, parishId, role, dioceseAdmin, limit } = parsedQuery.data;
  const supabase = getSupabaseAdminClient();

  const [{ data: users, error: usersError }, { data: memberships, error: membershipsError }, { data: adminRows, error: adminsError }, { data: parishes, error: parishesError }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("clerk_user_id,email,display_name,onboarding_completed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("parish_memberships").select("parish_id,clerk_user_id,role"),
    supabase.from("diocese_admins").select("clerk_user_id"),
    supabase.from("parishes").select("id,name"),
  ]);

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 });
  if (membershipsError) return NextResponse.json({ error: membershipsError.message }, { status: 400 });
  if (adminsError) return NextResponse.json({ error: adminsError.message }, { status: 400 });
  if (parishesError) return NextResponse.json({ error: parishesError.message }, { status: 400 });

  const parishRows = ((parishes ?? []) as ParishRow[]).sort((a, b) => a.name.localeCompare(b.name));
  const parishNameById = new Map(parishRows.map((parish) => [parish.id, parish.name]));

  const membershipsByUser = new Map<
    string,
    Array<{ parish_id: string; parish_name: string; role: "parish_admin" | "instructor" | "student" }>
  >();

  ((memberships ?? []) as ParishMembershipRow[]).forEach((membership) => {
    if (!membershipsByUser.has(membership.clerk_user_id)) {
      membershipsByUser.set(membership.clerk_user_id, []);
    }

    membershipsByUser.get(membership.clerk_user_id)?.push({
      parish_id: membership.parish_id,
      parish_name: parishNameById.get(membership.parish_id) ?? membership.parish_id,
      role: membership.role,
    });
  });

  const dioceseAdminIds = new Set(((adminRows ?? []) as DioceseAdminRow[]).map((row) => row.clerk_user_id));
  const normalizedQuery = q?.toLowerCase();

  const filteredUsers = ((users ?? []) as UserProfileRow[])
    .map((user) => {
      const userMemberships = membershipsByUser.get(user.clerk_user_id) ?? [];
      return {
        ...user,
        is_diocese_admin: dioceseAdminIds.has(user.clerk_user_id),
        memberships: userMemberships,
      };
    })
    .filter((user) => {
      if (!normalizedQuery) return true;
      return (
        user.clerk_user_id.toLowerCase().includes(normalizedQuery) ||
        (user.display_name ?? "").toLowerCase().includes(normalizedQuery) ||
        (user.email ?? "").toLowerCase().includes(normalizedQuery)
      );
    })
    .filter((user) => {
      if (onboarding === "yes") return Boolean(user.onboarding_completed_at);
      if (onboarding === "no") return !user.onboarding_completed_at;
      return true;
    })
    .filter((user) => {
      if (!parishId) return true;
      return user.memberships.some((membership) => membership.parish_id === parishId);
    })
    .filter((user) => {
      if (role === "all") return true;
      return user.memberships.some((membership) => membership.role === role);
    })
    .filter((user) => {
      if (dioceseAdmin === "yes") return user.is_diocese_admin;
      if (dioceseAdmin === "no") return !user.is_diocese_admin;
      return true;
    });

  return NextResponse.json({
    users: filteredUsers,
    parishes: parishRows,
  });
}
