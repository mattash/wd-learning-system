import { clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { E2E_PARISHES } from "@/lib/e2e-fixtures";
import { hasCompletedOnboarding, requireAuth } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  displayName: z.string().trim().min(1).max(120),
  parishId: z.string().uuid(),
});

async function completeOnboarding(formData: FormData) {
  "use server";
  const userId = await requireAuth();

  const parsed = schema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    parishId: String(formData.get("parishId") ?? ""),
  });

  if (!parsed.success) {
    redirect("/app/onboarding?error=invalid_input");
  }

  const store = await cookies();
  if (isE2ESmokeMode()) {
    const selectedParish = E2E_PARISHES.find((parish) => parish.id === parsed.data.parishId);
    if (!selectedParish) {
      redirect("/app/onboarding?error=invalid_parish");
    }

    store.set("e2e_onboarding_complete", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    store.set("active_parish_id", selectedParish.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    redirect("/app");
  }

  const supabase = getSupabaseAdminClient();
  const { data: parish } = await supabase
    .from("parishes")
    .select("id")
    .eq("id", parsed.data.parishId)
    .eq("allow_self_signup", true)
    .maybeSingle();

  if (!parish) {
    redirect("/app/onboarding?error=invalid_parish");
  }

  const now = new Date().toISOString();
  let primaryEmail: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    primaryEmail =
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
      user.primaryEmailAddress?.emailAddress ??
      null;
  } catch {
    primaryEmail = null;
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      clerk_user_id: userId,
      email: primaryEmail?.toLowerCase() ?? null,
      display_name: parsed.data.displayName,
      onboarding_completed_at: now,
    },
    { onConflict: "clerk_user_id" },
  );
  if (profileError) {
    redirect("/app/onboarding?error=profile_save_failed");
  }

  const { error: membershipError } = await supabase.from("parish_memberships").upsert(
    {
      parish_id: parsed.data.parishId,
      clerk_user_id: userId,
      role: "student",
    },
    { onConflict: "parish_id,clerk_user_id" },
  );
  if (membershipError) {
    redirect("/app/onboarding?error=membership_save_failed");
  }

  store.set("active_parish_id", parsed.data.parishId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/app");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const userId = await requireAuth();

  if (await hasCompletedOnboarding(userId)) {
    redirect("/app");
  }

  let profile: { display_name: string | null } | null = null;
  let parishes: Array<{ id: string; name: string; slug: string }> | null = null;

  if (isE2ESmokeMode()) {
    parishes = [...E2E_PARISHES];
  } else {
    const supabase = getSupabaseAdminClient();
    const [{ data: dbProfile }, { data: dbParishes }] = await Promise.all([
      supabase.from("user_profiles").select("display_name").eq("clerk_user_id", userId).maybeSingle(),
      supabase.from("parishes").select("id,name,slug").eq("allow_self_signup", true).order("name", { ascending: true }),
    ]);
    profile = (dbProfile as { display_name: string | null } | null) ?? null;
    parishes = (dbParishes as Array<{ id: string; name: string; slug: string }> | null) ?? null;
  }

  const params = (await searchParams) ?? {};
  const errorText =
    params.error === "invalid_input"
      ? "Please provide a display name and parish."
      : params.error === "invalid_parish"
        ? "That parish is not open for self-signup."
        : params.error === "profile_save_failed"
          ? "Could not save your profile. Please try again."
          : params.error === "membership_save_failed"
            ? "Could not create your parish membership. Please try again."
            : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Complete your profile</h1>
      <p className="text-sm text-muted-foreground">
        Pick your parish and set your display name to continue.
      </p>
      {errorText ? (
        <Alert variant="destructive">
          <AlertDescription>{errorText}</AlertDescription>
        </Alert>
      ) : null}
      {(parishes ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No parishes are currently open for self-signup. Contact a diocese admin.
        </p>
      ) : null}
      <Card>
        <CardContent className="pt-4">
          <form action={completeOnboarding} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Display name
              <Input
                defaultValue={(profile?.display_name as string | null) ?? ""}
                name="displayName"
                placeholder="Your name"
                required
                type="text"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Parish
              <Select defaultValue="" name="parishId" required>
                <option disabled value="">
                  Select a parish
                </option>
                {((parishes ?? []) as Array<{ id: string; name: string; slug: string }>).map((parish) => (
                  <option key={parish.id} value={parish.id}>
                    {parish.name} ({parish.slug})
                  </option>
                ))}
              </Select>
            </label>
            <Button disabled={(parishes ?? []).length === 0} type="submit">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
