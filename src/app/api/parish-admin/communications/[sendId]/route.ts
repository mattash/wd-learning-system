import { NextResponse } from "next/server";
import { z } from "zod";

import { requireParishRole } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  sendId: z.string().uuid(),
});

type RecipientDeliveryStatus = "not_configured" | "pending" | "sent" | "failed";

export async function GET(_req: Request, ctx: { params: Promise<{ sendId: string }> }) {
  const { parishId } = await requireParishRole("parish_admin");
  const params = paramsSchema.parse(await ctx.params);
  const supabase = getSupabaseAdminClient();

  const { data: send, error: sendError } = await supabase
    .from("parish_message_sends")
    .select("id,subject,body,delivery_status,recipient_count,created_at")
    .eq("id", params.sendId)
    .eq("parish_id", parishId)
    .maybeSingle();

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 400 });
  }
  if (!send) {
    return NextResponse.json({ error: "Message send not found." }, { status: 404 });
  }

  const { data: recipientRows, error: recipientError } = await supabase
    .from("parish_message_recipients")
    .select("clerk_user_id,delivery_status,delivery_attempted_at,delivery_error")
    .eq("send_id", params.sendId)
    .eq("parish_id", parishId)
    .order("clerk_user_id", { ascending: true })
    .limit(500);

  if (recipientError) {
    return NextResponse.json({ error: recipientError.message }, { status: 400 });
  }

  const recipients =
    (recipientRows as Array<{
      clerk_user_id: string;
      delivery_status: RecipientDeliveryStatus;
      delivery_attempted_at: string | null;
      delivery_error: string | null;
    }> | null) ?? [];

  const recipientIds = recipients.map((recipient) => recipient.clerk_user_id);
  let profiles: Array<{ clerk_user_id: string; email: string | null; display_name: string | null }> = [];
  if (recipientIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("user_profiles")
      .select("clerk_user_id,email,display_name")
      .in("clerk_user_id", recipientIds);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
    profiles =
      (profileRows as Array<{
        clerk_user_id: string;
        email: string | null;
        display_name: string | null;
      }> | null) ?? [];
  }

  const profileById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const summary = {
    total: recipients.length,
    not_configured: 0,
    pending: 0,
    sent: 0,
    failed: 0,
  };

  const detailedRecipients = recipients.map((recipient) => {
    summary[recipient.delivery_status] += 1;
    const profile = profileById.get(recipient.clerk_user_id);
    return {
      clerk_user_id: recipient.clerk_user_id,
      display_name: profile?.display_name ?? null,
      email: profile?.email ?? null,
      delivery_status: recipient.delivery_status,
      delivery_attempted_at: recipient.delivery_attempted_at,
      delivery_error: recipient.delivery_error,
    };
  });

  return NextResponse.json({
    send,
    summary,
    recipients: detailedRecipients,
  });
}
