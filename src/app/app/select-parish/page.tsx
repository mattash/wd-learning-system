import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { hasCompletedOnboarding } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function setActiveParishCookie(parishId: string) {
  return cookies().then((store) =>
    store.set("active_parish_id", parishId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    }),
  );
}

async function setActiveParish(formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const parishId = String(formData.get("parishId") ?? "");

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("parish_memberships")
    .select("id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!data) {
    redirect("/app/select-parish?error=invalid_membership");
  }

  await setActiveParishCookie(parishId);
  redirect("/app/courses");
}

async function joinParish(formData: FormData) {
  "use server";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const parishId = String(formData.get("parishId") ?? "");

  const supabase = getSupabaseAdminClient();
  const { data: parish } = await supabase
    .from("parishes")
    .select("id")
    .eq("id", parishId)
    .eq("allow_self_signup", true)
    .maybeSingle();

  if (!parish) {
    redirect("/app/select-parish?manage=1&error=invalid_parish");
  }

  const { error } = await supabase.from("parish_memberships").upsert(
    {
      parish_id: parishId,
      clerk_user_id: userId,
      role: "student",
    },
    { onConflict: "parish_id,clerk_user_id" },
  );

  if (error) {
    redirect("/app/select-parish?manage=1&error=join_failed");
  }

  await setActiveParishCookie(parishId);
  redirect("/app/courses");
}

type Parish = { id: string; name: string; slug: string };

function normalizeMembershipParishes(
  memberships: Array<{ parishes: Parish | Parish[] | null }> | null,
) {
  const seen = new Set<string>();
  return (memberships ?? [])
    .flatMap((item) => {
      if (!item.parishes) return [];
      return Array.isArray(item.parishes) ? item.parishes : [item.parishes];
    })
    .filter((parish) => {
      if (seen.has(parish.id)) return false;
      seen.add(parish.id);
      return true;
    });
}

export default async function SelectParishPage({
  searchParams,
}: {
  searchParams?: Promise<{ manage?: string; error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await hasCompletedOnboarding(userId))) {
    redirect("/app/onboarding");
  }

  const params = (await searchParams) ?? {};
  const manageMode = params.manage === "1";

  const supabase = getSupabaseAdminClient();
  const [{ data: memberships, error: membershipError }, { data: openParishes, error: openParishesError }] =
    await Promise.all([
      supabase.from("parish_memberships").select("parishes(id,name,slug)").eq("clerk_user_id", userId),
      supabase.from("parishes").select("id,name,slug").eq("allow_self_signup", true).order("name"),
    ]);

  const uniqueParishes = normalizeMembershipParishes(
    (memberships ?? []) as Array<{ parishes: Parish | Parish[] | null }>,
  );
  const membershipIds = new Set(uniqueParishes.map((parish) => parish.id));
  const joinableParishes = ((openParishes ?? []) as Parish[]).filter(
    (parish) => !membershipIds.has(parish.id),
  );

  if (!manageMode && uniqueParishes.length === 1) {
    await setActiveParishCookie(uniqueParishes[0].id);
    redirect("/app/courses");
  }

  const errorText =
    params.error === "invalid_membership"
      ? "You can only select a parish you are a member of."
      : params.error === "invalid_parish"
        ? "That parish is not open for self-signup."
        : params.error === "join_failed"
          ? "Could not join the parish. Please try again."
          : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Select Parish</h1>
        <p className="text-sm text-slate-600">Choose your active parish or join another parish.</p>
        {errorText ? <p className="text-sm text-red-700">{errorText}</p> : null}
      </div>

      {membershipError ? (
        <p className="text-sm text-red-700">Unable to load your parish memberships: {membershipError.message}</p>
      ) : uniqueParishes.length === 0 ? (
        <p className="text-sm text-slate-600">You are not a member of any parish yet.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="font-semibold">Your Parishes</h2>
          <div className="grid gap-3">
            {uniqueParishes.map((parish) => (
              <form key={parish.id} action={setActiveParish}>
                <input type="hidden" name="parishId" value={parish.id} />
                <Button className="w-full justify-start" type="submit" variant="outline">
                  {parish.name} ({parish.slug})
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}

      {openParishesError ? (
        <p className="text-sm text-red-700">Unable to load open parishes: {openParishesError.message}</p>
      ) : joinableParishes.length === 0 ? null : (
        <div className="space-y-2">
          <h2 className="font-semibold">Join Another Parish</h2>
          <div className="grid gap-3">
            {joinableParishes.map((parish) => (
              <form key={parish.id} action={joinParish}>
                <input type="hidden" name="parishId" value={parish.id} />
                <Button className="w-full justify-start" type="submit" variant="outline">
                  Join {parish.name} ({parish.slug})
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
