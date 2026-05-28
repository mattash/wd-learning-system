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

  const [{ data: memberships, error: membershipsError }, { data: adminRows, error: adminsError }, { data: parishes, error: parishesError }] = await Promise.all([
    supabase.from("parish_memberships").select("parish_id,clerk_user_id,role"),
    supabase.from("diocese_admins").select("clerk_user_id"),
    supabase.from("parishes").select("id,name"),
  ]);

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
  const candidateUserIds = getCandidateUserIds({
    memberships: (memberships ?? []) as ParishMembershipRow[],
    dioceseAdminIds,
    parishId,
    role,
    dioceseAdmin,
  });

  if (candidateUserIds && candidateUserIds.size === 0) {
    return NextResponse.json({
      users: [],
      parishes: parishRows,
    });
  }

  let usersQuery = supabase
    .from("user_profiles")
    .select("clerk_user_id,email,display_name,onboarding_completed_at,created_at");

  if (q) {
    const pattern = escapePostgrestPattern(q);
    usersQuery = usersQuery.or(
      `clerk_user_id.ilike.%${pattern}%,display_name.ilike.%${pattern}%,email.ilike.%${pattern}%`,
    );
  }

  if (onboarding === "yes") {
    usersQuery = usersQuery.not("onboarding_completed_at", "is", null);
  } else if (onboarding === "no") {
    usersQuery = usersQuery.is("onboarding_completed_at", null);
  }

  if (candidateUserIds) {
    usersQuery = usersQuery.in("clerk_user_id", Array.from(candidateUserIds));
  } else if (dioceseAdmin === "no" && dioceseAdminIds.size > 0) {
    usersQuery = usersQuery.not("clerk_user_id", "in", formatPostgrestInList(dioceseAdminIds));
  }

  const { data: users, error: usersError } = await usersQuery.order("created_at", { ascending: false }).limit(limit);

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 });

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
      if (dioceseAdmin === "yes") return user.is_diocese_admin;
      if (dioceseAdmin === "no") return !user.is_diocese_admin;
      return true;
    });

  return NextResponse.json({
    users: filteredUsers,
    parishes: parishRows,
  });
}

function getCandidateUserIds({
  memberships,
  dioceseAdminIds,
  parishId,
  role,
  dioceseAdmin,
}: {
  memberships: ParishMembershipRow[];
  dioceseAdminIds: Set<string>;
  parishId?: string;
  role: "all" | "parish_admin" | "instructor" | "student";
  dioceseAdmin: "all" | "yes" | "no";
}) {
  let candidates: Set<string> | null = null;

  if (parishId) {
    candidates = intersectCandidateIds(
      candidates,
      new Set(
        memberships
          .filter((membership) => membership.parish_id === parishId)
          .map((membership) => membership.clerk_user_id),
      ),
    );
  }

  if (role !== "all") {
    candidates = intersectCandidateIds(
      candidates,
      new Set(
        memberships
          .filter((membership) => membership.role === role)
          .map((membership) => membership.clerk_user_id),
      ),
    );
  }

  if (dioceseAdmin === "yes") {
    candidates = intersectCandidateIds(candidates, dioceseAdminIds);
  } else if (dioceseAdmin === "no" && candidates && dioceseAdminIds.size > 0) {
    candidates = new Set(Array.from(candidates).filter((id) => !dioceseAdminIds.has(id)));
  }

  return candidates;
}

function intersectCandidateIds(current: Set<string> | null, next: Set<string>) {
  if (!current) {
    return new Set(next);
  }

  return new Set(Array.from(current).filter((id) => next.has(id)));
}

function escapePostgrestPattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

function formatPostgrestInList(values: Set<string>) {
  return `(${Array.from(values)
    .map((value) => `"${value.replaceAll('"', '\\"')}"`)
    .join(",")})`;
}
