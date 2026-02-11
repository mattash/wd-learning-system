import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getParishDeliveryConfig } from "@/lib/parish-communications/delivery-provider";
import { enqueueParishMessageDeliveryJob } from "@/lib/parish-communications/delivery-jobs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const audienceTypeSchema = z.enum(["all_members", "stalled_learners", "cohort", "course"]);

const sendMessageSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  audienceType: audienceTypeSchema,
  audienceValue: z.string().uuid().optional(),
});

async function resolveRecipients({
  parishId,
  audienceType,
  audienceValue,
}: {
  parishId: string;
  audienceType: z.infer<typeof audienceTypeSchema>;
  audienceValue?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const stalledCutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

  if (audienceType === "all_members") {
    const { data, error } = await supabase
      .from("parish_memberships")
      .select("clerk_user_id")
      .eq("parish_id", parishId);
    if (error) {
      return { error: error.message, recipients: [] as string[] };
    }
    const recipients = Array.from(
      new Set((((data ?? []) as Array<{ clerk_user_id: string }>).map((row) => row.clerk_user_id)) ?? []),
    );
    return { error: null as string | null, recipients };
  }

  if (audienceType === "stalled_learners") {
    const { data, error } = await supabase
      .from("video_progress")
      .select("clerk_user_id")
      .eq("parish_id", parishId)
      .eq("completed", false)
      .lt("updated_at", stalledCutoff);
    if (error) {
      return { error: error.message, recipients: [] as string[] };
    }
    const recipients = Array.from(
      new Set((((data ?? []) as Array<{ clerk_user_id: string }>).map((row) => row.clerk_user_id)) ?? []),
    );
    return { error: null as string | null, recipients };
  }

  if (!audienceValue) {
    return { error: "audienceValue is required for cohort/course audiences.", recipients: [] as string[] };
  }

  if (audienceType === "cohort") {
    const { data: cohort, error: cohortError } = await supabase
      .from("cohorts")
      .select("id")
      .eq("parish_id", parishId)
      .eq("id", audienceValue)
      .maybeSingle();
    if (cohortError) {
      return { error: cohortError.message, recipients: [] as string[] };
    }
    if (!cohort) {
      return { error: "Cohort does not belong to this parish.", recipients: [] as string[] };
    }
    const { data, error } = await supabase
      .from("enrollments")
      .select("clerk_user_id")
      .eq("parish_id", parishId)
      .eq("cohort_id", audienceValue);
    if (error) {
      return { error: error.message, recipients: [] as string[] };
    }
    const recipients = Array.from(
      new Set((((data ?? []) as Array<{ clerk_user_id: string }>).map((row) => row.clerk_user_id)) ?? []),
    );
    return { error: null as string | null, recipients };
  }

  const { data, error } = await supabase
    .from("enrollments")
    .select("clerk_user_id")
    .eq("parish_id", parishId)
    .eq("course_id", audienceValue);
  if (error) {
    return { error: error.message, recipients: [] as string[] };
  }
  const recipients = Array.from(
    new Set((((data ?? []) as Array<{ clerk_user_id: string }>).map((row) => row.clerk_user_id)) ?? []),
  );
  return { error: null as string | null, recipients };
}

export async function GET() {
  const { parishId } = await requireParishRole("parish_admin");
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parish_message_sends")
    .select(
      "id,audience_type,audience_value,subject,body,recipient_count,delivery_status,created_by_clerk_user_id,created_at",
    )
    .eq("parish_id", parishId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sends: data ?? [] });
}

export async function POST(req: Request) {
  const { clerkUserId, parishId } = await requireParishRole("parish_admin");
  const payload = sendMessageSchema.parse(await req.json());
  const supabase = getSupabaseAdminClient();
  const deliveryConfig = getParishDeliveryConfig();

  if (
    (payload.audienceType === "cohort" || payload.audienceType === "course") &&
    !payload.audienceValue
  ) {
    return NextResponse.json(
      { error: "audienceValue is required for cohort/course audiences." },
      { status: 400 },
    );
  }

  const recipientResolution = await resolveRecipients({
    parishId,
    audienceType: payload.audienceType,
    audienceValue: payload.audienceValue,
  });

  if (recipientResolution.error) {
    return NextResponse.json({ error: recipientResolution.error }, { status: 400 });
  }

  const recipients = recipientResolution.recipients;
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients match this audience." }, { status: 400 });
  }

  const { data: send, error: sendError } = await supabase
    .from("parish_message_sends")
    .insert({
      parish_id: parishId,
      created_by_clerk_user_id: clerkUserId,
      audience_type: payload.audienceType,
      audience_value: payload.audienceValue ?? null,
      subject: payload.subject,
      body: payload.body,
      recipient_count: recipients.length,
      delivery_status: deliveryConfig.enabled ? "queued" : "not_configured",
      provider: deliveryConfig.provider,
    })
    .select(
      "id,audience_type,audience_value,subject,body,recipient_count,delivery_status,created_by_clerk_user_id,created_at",
    )
    .single();

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 400 });
  }

  const { error: recipientInsertError } = await supabase.from("parish_message_recipients").insert(
    recipients.map((recipientUserId) => ({
      send_id: send.id,
      parish_id: parishId,
      clerk_user_id: recipientUserId,
      delivery_status: deliveryConfig.enabled ? "pending" : "not_configured",
      delivery_attempted_at: null,
      provider_message_id: null,
      delivery_error: null,
    })),
  );

  if (recipientInsertError) {
    return NextResponse.json({ error: recipientInsertError.message }, { status: 400 });
  }

  if (deliveryConfig.enabled && deliveryConfig.provider) {
    try {
      await enqueueParishMessageDeliveryJob({
        parishId,
        sendId: send.id as string,
        provider: deliveryConfig.provider,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to enqueue delivery job.";
      await supabase.from("parish_message_sends").update({ delivery_status: "failed" }).eq("id", send.id as string);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  await recordAdminAuditLog({
    actorClerkUserId: clerkUserId,
    action: "parish.communication_logged",
    resourceType: "parish_message_send",
    resourceId: send.id as string,
    details: {
      parish_id: parishId,
      audience_type: payload.audienceType,
      audience_value: payload.audienceValue ?? null,
      recipient_count: recipients.length,
      delivery_status: deliveryConfig.enabled ? "queued" : "not_configured",
      provider: deliveryConfig.provider,
    },
  });

  return NextResponse.json({
    send,
    deliveryNote:
      deliveryConfig.enabled
        ? "Message queued for async delivery."
        : "Outbound delivery is not configured yet. This message has been logged for tracking only.",
  });
}
