import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { ParishRole } from "@/lib/types";

const parishMembershipRoleSchema = z.enum(["parish_admin", "instructor", "student"]);

const upsertPersonSchema = z.object({
  identifier: z.string().trim().min(1),
  role: parishMembershipRoleSchema.default("student"),
});

type SupabaseUserProfile = {
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
};

async function resolveUserByIdentifier(identifier: string): Promise<SupabaseUserProfile | null> {
  const normalizedIdentifier = identifier.trim();
  const supabase = getSupabaseAdminClient();
  const isEmail = normalizedIdentifier.includes("@");

  if (isEmail) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("clerk_user_id,email,display_name")
      .ilike("email", normalizedIdentifier)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const row = ((data ?? []) as SupabaseUserProfile[])[0];
    return row ?? null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("clerk_user_id,email,display_name")
    .eq("clerk_user_id", normalizedIdentifier)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SupabaseUserProfile | null) ?? null;
}

export async function POST(req: Request) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const payload = upsertPersonSchema.parse(await req.json());

  const userProfile = await resolveUserByIdentifier(payload.identifier);
  if (!userProfile) {
    return NextResponse.json(
      {
        error:
          "No existing platform account matches that identifier. Use an existing email or clerk_user_id.",
      },
      { status: 404 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parish_memberships")
    .upsert(
      {
        parish_id: parishId,
        clerk_user_id: userProfile.clerk_user_id,
        role: payload.role,
      },
      { onConflict: "parish_id,clerk_user_id" },
    )
    .select("parish_id,clerk_user_id,role")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.member_upserted",
    resourceType: "parish_membership",
    resourceId: userProfile.clerk_user_id,
    details: {
      parish_id: parishId,
      role: payload.role,
      identifier: payload.identifier,
    },
  });

  return NextResponse.json({
    membership: data,
    user: {
      clerk_user_id: userProfile.clerk_user_id,
      email: userProfile.email,
      display_name: userProfile.display_name,
    },
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === "\"") {
      if (insideQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (ch === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells.map((value) => value.replace(/^"(.*)"$/, "$1").trim());
}

function normalizeHeaderCell(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvRows(csvText: string) {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCsvLine(line));
}

const importMembersSchema = z.object({
  csvText: z.string().min(1),
  defaultRole: parishMembershipRoleSchema.default("student"),
});

interface ImportResultRow {
  row: number;
  identifier: string;
  role: ParishRole;
  status: "imported" | "skipped";
  message: string;
}

export async function PUT(req: Request) {
  const { clerkUserId: actorUserId, parishId } = await requireParishRole("parish_admin");
  const payload = importMembersSchema.parse(await req.json());
  const parsedRows = parseCsvRows(payload.csvText);

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: "CSV is empty." }, { status: 400 });
  }

  const header = parsedRows[0].map((cell) => normalizeHeaderCell(cell));
  const clerkIdIndex = header.indexOf("clerk_user_id");
  const emailIndex = header.indexOf("email");
  const roleIndex = header.indexOf("role");

  if (clerkIdIndex === -1 && emailIndex === -1) {
    return NextResponse.json(
      { error: "CSV header must include either clerk_user_id or email." },
      { status: 400 },
    );
  }

  const dataRows = parsedRows.slice(1);
  const supabase = getSupabaseAdminClient();
  const results: ImportResultRow[] = [];

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx += 1) {
    const row = dataRows[rowIdx];
    const rowNumber = rowIdx + 2;
    const clerkId = clerkIdIndex >= 0 ? (row[clerkIdIndex] ?? "").trim() : "";
    const email = emailIndex >= 0 ? (row[emailIndex] ?? "").trim() : "";
    const identifier = clerkId || email;

    const parsedRole = parishMembershipRoleSchema.safeParse(roleIndex >= 0 ? row[roleIndex] : undefined);
    const role = parsedRole.success ? parsedRole.data : payload.defaultRole;

    if (!identifier) {
      results.push({
        row: rowNumber,
        identifier: "",
        role,
        status: "skipped",
        message: "Missing identifier (email or clerk_user_id).",
      });
      continue;
    }

    let userProfile: SupabaseUserProfile | null = null;
    try {
      userProfile = await resolveUserByIdentifier(identifier);
    } catch (error) {
      results.push({
        row: rowNumber,
        identifier,
        role,
        status: "skipped",
        message: error instanceof Error ? error.message : "Failed to resolve user profile.",
      });
      continue;
    }

    if (!userProfile) {
      results.push({
        row: rowNumber,
        identifier,
        role,
        status: "skipped",
        message: "No platform account found.",
      });
      continue;
    }

    const { error } = await supabase.from("parish_memberships").upsert(
      {
        parish_id: parishId,
        clerk_user_id: userProfile.clerk_user_id,
        role,
      },
      { onConflict: "parish_id,clerk_user_id" },
    );

    if (error) {
      results.push({
        row: rowNumber,
        identifier,
        role,
        status: "skipped",
        message: error.message,
      });
      continue;
    }

    results.push({
      row: rowNumber,
      identifier: userProfile.clerk_user_id,
      role,
      status: "imported",
      message: "Membership saved.",
    });
  }

  const importedCount = results.filter((result) => result.status === "imported").length;
  const skippedCount = results.length - importedCount;

  await recordAdminAuditLog({
    actorClerkUserId: actorUserId,
    action: "parish.members_imported",
    resourceType: "parish_memberships",
    resourceId: parishId,
    details: {
      parish_id: parishId,
      imported_count: importedCount,
      skipped_count: skippedCount,
    },
  });

  return NextResponse.json({
    summary: {
      totalRows: results.length,
      importedCount,
      skippedCount,
    },
    results,
  });
}
