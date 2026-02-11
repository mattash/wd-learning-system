import { redirect } from "next/navigation";

import { requireActiveParish, requireAuth } from "@/lib/authz";

export default async function AppIndex() {
  await requireAuth();
  await requireActiveParish();
  redirect("/app/courses");
}
