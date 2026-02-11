import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { hasCompletedOnboarding } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  displayName: z.string().trim().min(1).max(120),
  parishId: z.string().uuid(),
});

async function completeOnboarding(formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const parsed = schema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    parishId: String(formData.get("parishId") ?? ""),
  });

  if (!parsed.success) {
    redirect("/app/onboarding?error=invalid_input");
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
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      clerk_user_id: userId,
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

  const store = await cookies();
  store.set("active_parish_id", parsed.data.parishId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/app/courses");
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  if (await hasCompletedOnboarding(userId)) {
    redirect("/app/courses");
  }

  const supabase = getSupabaseAdminClient();
  const [{ data: profile }, { data: parishes }] = await Promise.all([
    supabase.from("user_profiles").select("display_name").eq("clerk_user_id", userId).maybeSingle(),
    supabase.from("parishes").select("id,name,slug").eq("allow_self_signup", true).order("name", { ascending: true }),
  ]);

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
      <p className="text-sm text-slate-600">
        Pick your parish and set your display name to continue.
      </p>
      {errorText ? <p className="text-sm text-red-700">{errorText}</p> : null}
      {(parishes ?? []).length === 0 ? (
        <p className="text-sm text-slate-600">
          No parishes are currently open for self-signup. Contact a diocese admin.
        </p>
      ) : null}
      <form action={completeOnboarding} className="grid gap-3 rounded border bg-white p-4">
        <label className="grid gap-1 text-sm">
          Display name
          <input
            className="rounded border p-2"
            defaultValue={(profile?.display_name as string | null) ?? ""}
            name="displayName"
            placeholder="Your name"
            required
            type="text"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Parish
          <select className="rounded border p-2" defaultValue="" name="parishId" required>
            <option disabled value="">
              Select a parish
            </option>
            {((parishes ?? []) as Array<{ id: string; name: string; slug: string }>).map((parish) => (
              <option key={parish.id} value={parish.id}>
                {parish.name} ({parish.slug})
              </option>
            ))}
          </select>
        </label>
        <Button disabled={(parishes ?? []).length === 0} type="submit">
          Continue
        </Button>
      </form>
    </div>
  );
}
