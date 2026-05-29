import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CourseJoinRequest {
  id: string;
  parishId: string;
  clerkUserId: string;
  courseId: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CourseJoinRequestWithDetails extends CourseJoinRequest {
  studentName?: string;
  studentEmail?: string;
  courseTitle?: string;
}

/**
 * Create a join request for a student to join a course.
 * Fails if: already enrolled, already has a pending request.
 */
export async function createJoinRequest({
  parishId,
  clerkUserId,
  courseId,
}: {
  parishId: string;
  clerkUserId: string;
  courseId: string;
}): Promise<CourseJoinRequest> {
  const supabase = getSupabaseAdminClient();

  // Check if already enrolled
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (enrollment) {
    throw new Error("Already enrolled in this course");
  }

  // Check for existing pending request
  const { data: existingRequest } = await supabase
    .from("course_join_requests")
    .select("id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .eq("course_id", courseId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existingRequest) {
    throw new Error("A pending request already exists for this course");
  }

  // Create the request
  const { data, error } = await supabase
    .from("course_join_requests")
    .insert({
      parish_id: parishId,
      clerk_user_id: clerkUserId,
      course_id: courseId,
      status: "PENDING",
    })
    .select("id,parish_id,clerk_user_id,course_id,status,created_at,updated_at")
    .single();

  if (error) throw error;
  return {
    id: data!.id as string,
    parishId: data!.parish_id as string,
    clerkUserId: data!.clerk_user_id as string,
    courseId: data!.course_id as string,
    status: data!.status as JoinRequestStatus,
    createdAt: data!.created_at as string,
    updatedAt: data!.updated_at as string,
  };
}

/**
 * Get all join requests for a parish, optionally filtered by status.
 */
export async function getParishJoinRequests(
  parishId: string,
  status?: JoinRequestStatus
): Promise<CourseJoinRequestWithDetails[]> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("course_join_requests")
    .select("*,courses(title)")
    .eq("parish_id", parishId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    parish_id: string;
    clerk_user_id: string;
    course_id: string;
    status: JoinRequestStatus;
    created_at: string;
    updated_at: string;
    courses: { title: string } | null;
  }>).map((row) => ({
    id: row.id,
    parishId: row.parish_id,
    clerkUserId: row.clerk_user_id,
    courseId: row.course_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    courseTitle: row.courses?.title,
  }));
}

/**
 * Get pending join requests for a student (for the student UI).
 */
export async function getStudentPendingRequests({
  parishId,
  clerkUserId,
}: {
  parishId: string;
  clerkUserId: string;
}): Promise<CourseJoinRequest[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("course_join_requests")
    .select("id,parish_id,clerk_user_id,course_id,status,created_at,updated_at")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", clerkUserId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    parish_id: string;
    clerk_user_id: string;
    course_id: string;
    status: JoinRequestStatus;
    created_at: string;
    updated_at: string;
  }>).map((row) => ({
    id: row.id,
    parishId: row.parish_id,
    clerkUserId: row.clerk_user_id,
    courseId: row.course_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Approve a join request: creates enrollment + marks request APPROVED.
 */
export async function approveJoinRequest({
  requestId,
  actorClerkUserId,
}: {
  requestId: string;
  actorClerkUserId: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // Get the request
  const { data: request, error: requestError } = await supabase
    .from("course_join_requests")
    .select("parish_id,clerk_user_id,course_id")
    .eq("id", requestId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (requestError || !request) {
    throw new Error("Request not found or not pending");
  }

  // Mark request as approved first (only if still PENDING) — guard against concurrent rejection
  const { error: updateError, count } = await supabase
    .from("course_join_requests")
    .update({ status: "APPROVED" })
    .eq("id", requestId)
    .eq("status", "PENDING");

  if (updateError) throw updateError;
  if ((count ?? 0) === 0) {
    throw new Error("Request status changed before approval completed");
  }

  // Create enrollment (after successfully transitioning the request)
  const { error: enrollmentError } = await supabase
    .from("enrollments")
    .upsert(
      {
        parish_id: request.parish_id,
        clerk_user_id: request.clerk_user_id,
        course_id: request.course_id,
      },
      { onConflict: "parish_id,clerk_user_id,course_id" }
    );

  if (enrollmentError) {
    // Roll back the approval if enrollment creation fails
    await supabase
      .from("course_join_requests")
      .update({ status: "PENDING" })
      .eq("id", requestId);
    throw enrollmentError;
  }

  // Audit log
  const { recordAdminAuditLog } = await import("@/lib/audit-log");
  await recordAdminAuditLog({
    actorClerkUserId,
    action: "parish.join_request_approved",
    resourceType: "course_join_request",
    resourceId: requestId,
    details: {
      parish_id: request.parish_id,
      clerk_user_id: request.clerk_user_id,
      course_id: request.course_id,
    },
  });
}

/**
 * Reject a join request.
 */
export async function rejectJoinRequest({
  requestId,
  actorClerkUserId,
}: {
  requestId: string;
  actorClerkUserId: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // Get the request
  const { data: request, error: requestError } = await supabase
    .from("course_join_requests")
    .select("parish_id,clerk_user_id,course_id")
    .eq("id", requestId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (requestError || !request) {
    throw new Error("Request not found or not pending");
  }

  // Mark request as rejected (only if still PENDING)
  const { error: updateError, count } = await supabase
    .from("course_join_requests")
    .update({ status: "REJECTED" })
    .eq("id", requestId)
    .eq("status", "PENDING");

  if (updateError) throw updateError;
  if ((count ?? 0) === 0) {
    throw new Error("Request status changed before rejection completed");
  }

  // Audit log
  const { recordAdminAuditLog } = await import("@/lib/audit-log");
  await recordAdminAuditLog({
    actorClerkUserId,
    action: "parish.join_request_rejected",
    resourceType: "course_join_request",
    resourceId: requestId,
    details: {
      parish_id: request.parish_id,
      clerk_user_id: request.clerk_user_id,
      course_id: request.course_id,
    },
  });
}