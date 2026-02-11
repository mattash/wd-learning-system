import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { E2E_PARISHES } from "@/lib/e2e-fixtures";
import { requireAuth } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function buildRedirect(pathname: string, requestUrl: string) {
  return NextResponse.redirect(new URL(pathname, requestUrl));
}

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

export async function GET(req: Request) {
  const userId = await requireAuth();
  const requestUrl = new URL(req.url);
  const parishId = requestUrl.searchParams.get("parishId") ?? "";

  if (!parishId) {
    return buildRedirect("/app/select-parish?error=invalid_membership", req.url);
  }

  if (isE2ESmokeMode()) {
    const parish = E2E_PARISHES.find((item) => item.id === parishId);
    if (!parish) {
      return buildRedirect("/app/select-parish?error=invalid_membership", req.url);
    }
    await setActiveParishCookie(parish.id);
    return buildRedirect("/app", req.url);
  }

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("parish_memberships")
    .select("id")
    .eq("parish_id", parishId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!data) {
    return buildRedirect("/app/select-parish?error=invalid_membership", req.url);
  }

  await setActiveParishCookie(parishId);
  return buildRedirect("/app", req.url);
}
