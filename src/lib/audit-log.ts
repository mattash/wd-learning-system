import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface AdminAuditLogRow {
  id: string;
  actor_clerk_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AdminAuditLogFilters {
  action?: string;
  actorClerkUserId?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface RecordAdminAuditLogInput {
  actorClerkUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAdminAuditLog(input: RecordAdminAuditLogInput) {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("audit_logs").insert({
      actor_clerk_user_id: input.actorClerkUserId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      details: input.details ?? {},
    });
  } catch {
    // Audit logging should not block admin workflows.
  }
}

export async function listAdminAuditLogs(filters: AdminAuditLogFilters = {}) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("audit_logs")
    .select("id,actor_clerk_user_id,action,resource_type,resource_id,details,created_at")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  if (filters.actorClerkUserId) {
    query = query.eq("actor_clerk_user_id", filters.actorClerkUserId);
  }

  if (filters.resourceType) {
    query = query.eq("resource_type", filters.resourceType);
  }

  if (filters.startDate) {
    query = query.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
  }

  if (filters.endDate) {
    query = query.lte("created_at", `${filters.endDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((data ?? []) as AdminAuditLogRow[]) ?? [];
}
