import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { E2E_PARISHES } from "@/lib/e2e-fixtures";
import { hasCompletedOnboarding, requireAuth } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
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
  const userId = await requireAuth();
  const parishId = String(formData.get("parishId") ?? "");

  if (isE2ESmokeMode()) {
    const parish = E2E_PARISHES.find((item) => item.id === parishId);
    if (!parish) {
      redirect("/app/select-parish?error=invalid_membership");
    }
    await setActiveParishCookie(parish.id);
    redirect("/app");
  }

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
  redirect("/app");
}

async function joinParish(formData: FormData) {
  "use server";
  const userId = await requireAuth();
  const parishId = String(formData.get("parishId") ?? "");

  if (isE2ESmokeMode()) {
    const parish = E2E_PARISHES.find((item) => item.id === parishId);
    if (!parish) {
      redirect("/app/select-parish?manage=1&error=invalid_parish");
    }
    await setActiveParishCookie(parish.id);
    redirect("/app");
  }

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
  redirect("/app");
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
  const userId = await requireAuth();
  if (!(await hasCompletedOnboarding(userId))) {
    redirect("/app/onboarding");
  }

  const params = (await searchParams) ?? {};
  const manageMode = params.manage === "1";

  let memberships: Array<{ parishes: Parish | Parish[] | null }> | null = null;
  let membershipError: { message: string } | null = null;
  let openParishes: Parish[] | null = null;
  let openParishesError: { message: string } | null = null;

  if (isE2ESmokeMode()) {
    memberships = [{ parishes: E2E_PARISHES[0] as Parish }];
    openParishes = [...E2E_PARISHES] as Parish[];
  } else {
    const supabase = getSupabaseAdminClient();
    const [membershipResult, openParishesResult] = await Promise.all([
      supabase.from("parish_memberships").select("parishes(id,name,slug)").eq("clerk_user_id", userId),
      supabase.from("parishes").select("id,name,slug").eq("allow_self_signup", true).order("name"),
    ]);
    memberships = (membershipResult.data as Array<{ parishes: Parish | Parish[] | null }> | null) ?? null;
    membershipError = membershipResult.error;
    openParishes = (openParishesResult.data as Parish[] | null) ?? null;
    openParishesError = openParishesResult.error;
  }

  const uniqueParishes = normalizeMembershipParishes(
    memberships,
  );
  const membershipIds = new Set(uniqueParishes.map((parish) => parish.id));
  const joinableParishes = (openParishes ?? []).filter(
    (parish) => !membershipIds.has(parish.id),
  );

  if (!manageMode && uniqueParishes.length === 1) {
    const params = new URLSearchParams({ parishId: uniqueParishes[0].id });
    redirect(`/app/select-parish/activate?${params.toString()}`);
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
      <Card>
        <CardHeader>
          <CardTitle>Select Parish</CardTitle>
          <CardDescription>Choose your active parish or join another parish.</CardDescription>
        </CardHeader>
        {errorText ? (
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{errorText}</AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      {membershipError ? (
        <Alert variant="destructive">
          <AlertTitle>Memberships Unavailable</AlertTitle>
          <AlertDescription>
            Unable to load your parish memberships: {membershipError.message}
          </AlertDescription>
        </Alert>
      ) : uniqueParishes.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              You are not a member of any parish yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Parishes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {uniqueParishes.map((parish) => (
              <form key={parish.id} action={setActiveParish}>
                <input type="hidden" name="parishId" value={parish.id} />
                <Button className="w-full justify-start" type="submit" variant="outline">
                  {parish.name} ({parish.slug})
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      {openParishesError ? (
        <Alert variant="destructive">
          <AlertTitle>Open Parishes Unavailable</AlertTitle>
          <AlertDescription>
            Unable to load open parishes: {openParishesError.message}
          </AlertDescription>
        </Alert>
      ) : joinableParishes.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Join Another Parish</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {joinableParishes.map((parish) => (
              <form key={parish.id} action={joinParish}>
                <input type="hidden" name="parishId" value={parish.id} />
                <Button className="w-full justify-start" type="submit" variant="outline">
                  Join {parish.name} ({parish.slug})
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
