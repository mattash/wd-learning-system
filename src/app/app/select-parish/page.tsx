import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

async function setActiveParish(formData: FormData) {
  "use server";
  const parishId = String(formData.get("parishId") ?? "");
  const store = await cookies();
  store.set("active_parish_id", parishId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/app/courses");
}

export default async function SelectParishPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getSupabaseAdminClient();
  const { data: parishes } = await supabase
    .from("parish_memberships")
    .select("parishes(id,name,slug)")
    .eq("clerk_user_id", userId);

  const uniqueParishes =
    ((parishes ?? []) as Array<{ parishes: { id: string; name: string; slug: string }[] | null }>)
      .flatMap((item) => item.parishes ?? []);

  if (uniqueParishes.length === 1) {
    const store = await cookies();
    store.set("active_parish_id", uniqueParishes[0].id);
    redirect("/app/courses");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Select Parish</h1>
      <div className="grid gap-3">
        {uniqueParishes.map((parish: { id: string; name: string; slug: string }) => (
          <form key={parish.id} action={setActiveParish}>
            <input type="hidden" name="parishId" value={parish.id} />
            <Button className="w-full justify-start" type="submit" variant="outline">
              {parish.name} ({parish.slug})
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
